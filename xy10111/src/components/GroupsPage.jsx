import React, { useState } from 'react';
import { dataStore, validators } from '../utils/dataStore';
import {
  generateId,
  formatDateTime,
  confirmAction,
  toast,
} from '../utils/helpers';

function GroupsPage({ data, refreshData }) {
  const { groups, meetings, dispatches } = data;
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    members: [],
  });
  const [errors, setErrors] = useState({});

  const handleOpenNew = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      description: '',
      members: [],
    });
    setErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      members: [...(group.members || [])],
    });
    setErrors({});
    setShowModal(true);
  };

  const handleDelete = async (group) => {
    const usedInMeetings = meetings.filter(m => 
      m.groups?.some(g => g.name === group.name)
    );

    const usedInDispatches = dispatches.filter(d => {
      return d.groups?.some(g => g.name === group.name);
    });

    let warningMessage = `确定要删除小组「${group.name}」吗？`;
    if (usedInMeetings.length > 0) {
      warningMessage += `\n\n⚠️ 该小组在 ${usedInMeetings.length} 个会议中被引用。`;
    }
    if (usedInDispatches.length > 0) {
      warningMessage += `\n⚠️ 有 ${usedInDispatches.length} 条分发记录涉及该小组。`;
    }
    warningMessage += '\n\n删除后历史记录中的相关信息不会被清除，但该小组将不再出现在新的分发选项中。';

    const confirmed = await confirmAction(warningMessage, '确认删除');
    if (confirmed) {
      const updatedGroups = groups.filter(g => g.id !== group.id);
      const saved = await dataStore.saveGroups(updatedGroups);
      if (saved) {
        toast.success('小组已删除');
        await refreshData();
      } else {
        toast.error('删除失败，请重试');
      }
    }
  };

  const handleAddMember = () => {
    const memberName = prompt('请输入成员姓名：');
    if (!memberName || !memberName.trim()) return;

    const trimmedName = memberName.trim();
    const exists = formData.members.includes(trimmedName);
    if (exists) {
      toast.warning('成员已存在');
      return;
    }

    setFormData(prev => ({
      ...prev,
      members: [...prev.members, trimmedName],
    }));
  };

  const handleRemoveMember = (memberName) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter(m => m !== memberName),
    }));
  };

  const handleSave = async () => {
    const validationErrors = validators.validateGroup(formData);
    if (validationErrors.length > 0) {
      const errorMap = {};
      validationErrors.forEach(e => {
        errorMap[e.field] = e.message;
      });
      setErrors(errorMap);
      toast.error('请填写必要字段');
      return;
    }

    const duplicateName = groups.find(
      g => g.name === formData.name && g.id !== (editingGroup?.id || '')
    );
    if (duplicateName) {
      setErrors({ name: '小组名称已存在' });
      toast.error('小组名称已存在');
      return;
    }

    const groupData = {
      ...formData,
      id: editingGroup ? editingGroup.id : generateId(),
      createdAt: editingGroup ? editingGroup.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let updatedGroups;
    if (editingGroup) {
      updatedGroups = groups.map(g =>
        g.id === editingGroup.id ? groupData : g
      );
    } else {
      updatedGroups = [...groups, groupData];
    }

    const saved = await dataStore.saveGroups(updatedGroups);
    if (saved) {
      toast.success(editingGroup ? '小组已更新' : '小组已创建');
      setShowModal(false);
      await refreshData();
    } else {
      toast.error('保存失败，请重试');
    }
  };

  const getGroupUsage = (group) => {
    const meetingCount = meetings.filter(m =>
      m.groups?.some(g => g.name === group.name)
    ).length;
    return { meetingCount };
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3>小组库管理</h3>
          <button className="btn btn-primary" onClick={handleOpenNew}>
            + 新建小组
          </button>
        </div>
        <div className="card-body">
          {groups.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">暂无小组</div>
              <div className="empty-state-message">
                您可以在这里创建常用的接收小组，也可以在创建会议时直接添加小组
              </div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>小组名称</th>
                  <th>成员数</th>
                  <th>描述</th>
                  <th>被引用会议数</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => {
                  const usage = getGroupUsage(group);
                  return (
                    <tr key={group.id}>
                      <td className="font-bold">{group.name}</td>
                      <td>
                        <span className="badge badge-primary">
                          {group.members?.length || 0} 人
                        </span>
                      </td>
                      <td className="text-muted">
                        {group.description || '-'}
                      </td>
                      <td>
                        <span className={usage.meetingCount > 0 ? 'badge badge-warning' : 'badge badge-default'}>
                          {usage.meetingCount} 个
                        </span>
                      </td>
                      <td className="text-muted">
                        {formatDateTime(group.createdAt)}
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-sm btn-default"
                            onClick={() => handleOpenEdit(group)}
                          >
                            编辑
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(group)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowModal(false);
        }}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editingGroup ? '编辑小组' : '新建小组'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>小组名称 <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className={`form-control ${errors.name ? 'error' : ''}`}
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="请输入小组名称，如：技术组、市场部"
                />
                {errors.name && (
                  <div className="validation-error">{errors.name}</div>
                )}
              </div>

              <div className="form-group">
                <label>小组描述</label>
                <textarea
                  className="form-control"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="请输入小组描述（可选）"
                  rows={2}
                />
              </div>

              <div className="form-group">
                <div className="d-flex justify-between align-center">
                  <label>小组成员</label>
                  <button className="btn btn-sm btn-primary" onClick={handleAddMember}>
                    + 添加成员
                  </button>
                </div>
                {formData.members.length === 0 ? (
                  <p className="text-muted" style={{ marginTop: '8px' }}>
                    暂无成员，点击「添加成员」按钮添加
                  </p>
                ) : (
                  <div style={{ marginTop: '12px' }}>
                    {formData.members.map((member, idx) => (
                      <span key={idx} className="member-tag">
                        {member}
                        <button onClick={() => handleRemoveMember(member)}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editingGroup ? '保存修改' : '创建小组'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupsPage;
