import React, { useState } from 'react';
import { dataStore, validators } from '../utils/dataStore';
import {
  generateId,
  formatDate,
  formatDateTime,
  formatFileSize,
  getFileIcon,
  selectFiles,
  confirmAction,
  toast,
  openFileInFolder,
} from '../utils/helpers';

function MeetingsPage({ data, refreshData }) {
  const { meetings } = data;
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    attendees: '',
    notes: '',
    attachments: [],
    groups: [],
  });
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('info');
  const [missingFiles, setMissingFiles] = useState([]);

  const handleOpenNew = () => {
    setEditingMeeting(null);
    setFormData({
      title: '',
      date: new Date().toISOString().split('T')[0],
      location: '',
      attendees: '',
      notes: '',
      attachments: [],
      groups: [],
    });
    setErrors({});
    setMissingFiles([]);
    setShowModal(true);
  };

  const handleOpenEdit = (meeting) => {
    setEditingMeeting(meeting);
    setFormData({
      title: meeting.title,
      date: meeting.date,
      location: meeting.location || '',
      attendees: meeting.attendees || '',
      notes: meeting.notes || '',
      attachments: [...(meeting.attachments || [])],
      groups: [...(meeting.groups || [])],
    });
    setErrors({});
    setMissingFiles([]);
    setShowModal(true);
  };

  const handleDelete = async (meeting) => {
    const confirmed = await confirmAction(
      `确定要删除会议「${meeting.title}」吗？\n\n相关的附件信息和分发记录将保留，但会议信息会被删除。`,
      '确认删除'
    );
    if (confirmed) {
      const updatedMeetings = meetings.filter(m => m.id !== meeting.id);
      const saved = await dataStore.saveMeetings(updatedMeetings);
      if (saved) {
        toast.success('会议已删除');
        await refreshData();
      } else {
        toast.error('删除失败，请重试');
      }
    }
  };

  const handleImportAttachments = async () => {
    const files = await selectFiles();
    if (files.length === 0) return;

    const newAttachments = [];
    const duplicates = [];
    const electronAPI = window.electronAPI;

    for (const filePath of files) {
      const fileName = filePath.split(/[\\/]/).pop();
      const existing = formData.attachments.find(
        a => a.originalPath === filePath || a.name === fileName
      );
      
      if (existing) {
        duplicates.push(fileName);
        continue;
      }

      const stats = await electronAPI.getFileStats(filePath);
      newAttachments.push({
        id: generateId(),
        name: fileName,
        originalPath: filePath,
        filePath: filePath,
        size: stats.size,
        modifiedTime: stats.modifiedTime,
        importedAt: new Date().toISOString(),
        version: 1,
      });
    }

    if (duplicates.length > 0) {
      toast.warning(`跳过 ${duplicates.length} 个重复文件：${duplicates.join('、')}`);
    }

    if (newAttachments.length > 0) {
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments],
      }));
      toast.success(`已导入 ${newAttachments.length} 个附件`);
    }
  };

  const handleRemoveAttachment = (attachmentId) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(a => a.id !== attachmentId),
    }));
  };

  const handleUpdateAttachment = (attachmentId, field, value) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.map(a =>
        a.id === attachmentId ? { ...a, [field]: value } : a
      ),
    }));
  };

  const handleAddGroup = () => {
    const groupName = prompt('请输入小组名称：');
    if (!groupName || !groupName.trim()) return;

    const trimmedName = groupName.trim();
    const exists = formData.groups.find(g => g.name === trimmedName);
    if (exists) {
      toast.warning('小组名称已存在');
      return;
    }

    setFormData(prev => ({
      ...prev,
      groups: [...prev.groups, { id: generateId(), name: trimmedName, members: [] }],
    }));
  };

  const handleRemoveGroup = (groupId) => {
    setFormData(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.id !== groupId),
    }));
  };

  const handleAddMember = (groupId) => {
    const memberName = prompt('请输入成员姓名：');
    if (!memberName || !memberName.trim()) return;

    const trimmedName = memberName.trim();
    const group = formData.groups.find(g => g.id === groupId);
    if (!group) return;

    const exists = group.members.includes(trimmedName);
    if (exists) {
      toast.warning('成员已存在');
      return;
    }

    setFormData(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId
          ? { ...g, members: [...g.members, trimmedName] }
          : g
      ),
    }));
  };

  const handleRemoveMember = (groupId, memberName) => {
    setFormData(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId
          ? { ...g, members: g.members.filter(m => m !== memberName) }
          : g
      ),
    }));
  };

  const checkAttachments = async () => {
    const missing = [];
    const electronAPI = window.electronAPI;
    
    for (const att of formData.attachments) {
      const exists = await electronAPI.fileExists(att.filePath);
      if (!exists) {
        missing.push({ ...att, error: '文件不存在' });
      }
    }
    
    setMissingFiles(missing);
    if (missing.length > 0) {
      toast.warning(`发现 ${missing.length} 个文件缺失`);
    } else {
      toast.success('所有文件路径有效');
    }
  };

  const handleSave = async () => {
    const validationErrors = validators.validateMeeting(formData);
    if (validationErrors.length > 0) {
      const errorMap = {};
      validationErrors.forEach(e => {
        errorMap[e.field] = e.message;
      });
      setErrors(errorMap);
      toast.error('请填写必要字段');
      return;
    }

    if (formData.attachments.length === 0) {
      const confirmed = await confirmAction(
        '当前会议还没有添加任何附件，确定要保存吗？',
        '确认保存'
      );
      if (!confirmed) return;
    }

    const meetingData = {
      ...formData,
      id: editingMeeting ? editingMeeting.id : generateId(),
      createdAt: editingMeeting ? editingMeeting.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let updatedMeetings;
    if (editingMeeting) {
      updatedMeetings = meetings.map(m =>
        m.id === editingMeeting.id ? meetingData : m
      );
    } else {
      updatedMeetings = [...meetings, meetingData];
    }

    const saved = await dataStore.saveMeetings(updatedMeetings);
    if (saved) {
      toast.success(editingMeeting ? '会议已更新' : '会议已创建');
      setShowModal(false);
      await refreshData();
    } else {
      toast.error('保存失败，请重试');
    }
  };

  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>会议列表</h3>
          <button className="btn btn-primary" onClick={handleOpenNew}>
            + 新建会议
          </button>
        </div>
        <div className="card-body">
          {sortedMeetings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">暂无会议</div>
              <div className="empty-state-message">点击右上角「新建会议」开始创建</div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>会议标题</th>
                  <th>日期</th>
                  <th>地点</th>
                  <th>附件</th>
                  <th>参与小组</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedMeetings.map(meeting => (
                  <tr key={meeting.id}>
                    <td className="font-bold">{meeting.title}</td>
                    <td>{meeting.date}</td>
                    <td className="text-muted">{meeting.location || '-'}</td>
                    <td>
                      <span className="badge badge-primary">
                        {meeting.attachments?.length || 0} 个
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-success">
                        {meeting.groups?.length || 0} 组
                      </span>
                    </td>
                    <td className="text-muted">
                      {formatDateTime(meeting.createdAt)}
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-default"
                          onClick={() => handleOpenEdit(meeting)}
                        >
                          编辑
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(meeting)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowModal(false);
        }}>
          <div className="modal modal-xl">
            <div className="modal-header">
              <h3>{editingMeeting ? '编辑会议' : '新建会议'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="tabs">
                <div
                  className={`tab-item ${activeTab === 'info' ? 'active' : ''}`}
                  onClick={() => setActiveTab('info')}
                >
                  基本信息
                </div>
                <div
                  className={`tab-item ${activeTab === 'attachments' ? 'active' : ''}`}
                  onClick={() => setActiveTab('attachments')}
                >
                  附件管理 ({formData.attachments.length})
                </div>
                <div
                  className={`tab-item ${activeTab === 'groups' ? 'active' : ''}`}
                  onClick={() => setActiveTab('groups')}
                >
                  参与小组 ({formData.groups.length})
                </div>
              </div>

              {activeTab === 'info' && (
                <div>
                  <div className="row">
                    <div className="col-6">
                      <div className="form-group">
                        <label>会议标题 <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className={`form-control ${errors.title ? 'error' : ''}`}
                          value={formData.title}
                          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="请输入会议标题"
                        />
                        {errors.title && (
                          <div className="validation-error">{errors.title}</div>
                        )}
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="form-group">
                        <label>会议日期 <span className="text-danger">*</span></label>
                        <input
                          type="date"
                          className={`form-control ${errors.date ? 'error' : ''}`}
                          value={formData.date}
                          onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        />
                        {errors.date && (
                          <div className="validation-error">{errors.date}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>会议地点</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="请输入会议地点"
                    />
                  </div>
                  <div className="form-group">
                    <label>参会人员（用逗号分隔）</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.attendees}
                      onChange={(e) => setFormData(prev => ({ ...prev, attendees: e.target.value }))}
                      placeholder="张三, 李四, 王五"
                    />
                  </div>
                  <div className="form-group">
                    <label>会议纪要</label>
                    <textarea
                      className="form-control"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="请输入会议纪要内容..."
                      rows={4}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'attachments' && (
                <div>
                  <div className="d-flex justify-between align-center mb-4">
                    <div>
                      <p className="text-muted">
                        支持导入各种格式的会议附件，系统会自动检测文件是否存在和重复
                      </p>
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-default" onClick={checkAttachments}>
                        🔍 检查文件有效性
                      </button>
                      <button className="btn btn-primary" onClick={handleImportAttachments}>
                        📎 导入附件
                      </button>
                    </div>
                  </div>

                  {missingFiles.length > 0 && (
                    <div className="alert alert-error mb-4">
                      <span className="alert-icon">⚠️</span>
                      <div className="alert-content">
                        <div className="alert-title">文件缺失警告</div>
                        <div className="alert-message">
                          以下文件路径不存在，请检查：
                          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                            {missingFiles.map((f, i) => (
                              <li key={i}>{f.name} - {f.filePath}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.attachments.length === 0 ? (
                    <div className="file-drop-zone" onClick={handleImportAttachments}>
                      <div className="file-drop-zone-icon">📁</div>
                      <div className="file-drop-zone-title">点击选择文件或拖拽到此处</div>
                      <div className="file-drop-zone-hint">支持所有文件格式</div>
                    </div>
                  ) : (
                    <div>
                      {formData.attachments.map((attachment, index) => {
                        const isMissing = missingFiles.some(f => f.id === attachment.id);
                        return (
                          <div key={attachment.id} className="file-item" style={{
                            border: isMissing ? '1px solid #ff4d4f' : 'none',
                          }}>
                            <div className="file-item-icon">
                              {getFileIcon(attachment.name)}
                            </div>
                            <div className="file-item-info">
                              <div className="file-item-name">
                                <input
                                  type="text"
                                  className="form-control"
                                  style={{ width: '100%', border: 'none', background: 'transparent', padding: '0', fontWeight: '500' }}
                                  value={attachment.name}
                                  onChange={(e) => handleUpdateAttachment(attachment.id, 'name', e.target.value)}
                                />
                              </div>
                              <div className="file-item-meta">
                                {formatFileSize(attachment.size)} · 
                                {attachment.filePath}
                                {isMissing && (
                                  <span className="text-danger" style={{ marginLeft: '8px' }}>
                                    ⚠️ 文件不存在
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="file-item-actions">
                              <button
                                className="btn btn-sm btn-default"
                                onClick={() => openFileInFolder(attachment.filePath)}
                              >
                                打开位置
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleRemoveAttachment(attachment.id)}
                              >
                                移除
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'groups' && (
                <div>
                  <div className="d-flex justify-between align-center mb-4">
                    <p className="text-muted">
                      定义接收附件的小组及成员，分发时可以按小组进行分配
                    </p>
                    <button className="btn btn-primary" onClick={handleAddGroup}>
                      + 添加小组
                    </button>
                  </div>

                  {formData.groups.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">👥</div>
                      <div className="empty-state-title">暂无小组</div>
                      <div className="empty-state-message">点击「添加小组」创建接收附件的小组</div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '16px' }}>
                      {formData.groups.map(group => (
                        <div key={group.id} className="card" style={{ marginBottom: '0' }}>
                          <div className="card-header" style={{ padding: '12px 16px' }}>
                            <div className="d-flex align-center gap-2">
                              <span className="font-bold">{group.name}</span>
                              <span className="badge badge-default">
                                {group.members.length} 人
                              </span>
                            </div>
                            <div className="d-flex gap-2">
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleAddMember(group.id)}
                              >
                                + 添加成员
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleRemoveGroup(group.id)}
                              >
                                删除小组
                              </button>
                            </div>
                          </div>
                          <div className="card-body" style={{ padding: '16px' }}>
                            {group.members.length === 0 ? (
                              <span className="text-muted">暂无成员</span>
                            ) : (
                              <div>
                                {group.members.map((member, idx) => (
                                  <span key={idx} className="member-tag">
                                    {member}
                                    <button onClick={() => handleRemoveMember(group.id, member)}>
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editingMeeting ? '保存修改' : '创建会议'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MeetingsPage;
