import React, { useState, useEffect } from 'react';
import { dataStore, validators } from '../utils/dataStore';
import {
  generateId,
  DISPATCH_STATUS,
  DISPATCH_STATUS_LABELS,
  DISPATCH_STATUS_COLORS,
  formatDateTime,
  formatFileSize,
  getFileIcon,
  confirmAction,
  toast,
} from '../utils/helpers';

const STEPS = {
  SELECT_MEETING: 1,
  SELECT_ATTACHMENTS: 2,
  SELECT_GROUPS: 3,
  REVIEW: 4,
};

function DispatchPage({ data, refreshData }) {
  const { meetings, dispatches } = data;
  const [currentStep, setCurrentStep] = useState(STEPS.SELECT_MEETING);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [missingFiles, setMissingFiles] = useState([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState([]);

  const meetingsWithAttachments = meetings.filter(m => m.attachments?.length > 0);

  const checkFileExistence = async (attachments) => {
    const electronAPI = window.electronAPI;
    const missing = [];
    
    for (const att of attachments) {
      const exists = await electronAPI.fileExists(att.filePath);
      if (!exists) {
        missing.push({ ...att, error: '文件不存在' });
      }
    }
    return missing;
  };

  const handleSelectMeeting = async (meeting) => {
    setSelectedMeeting(meeting);
    setSelectedAttachments([]);
    setSelectedGroups([]);
    setWarnings([]);
    setMissingFiles([]);
    setDuplicateWarnings([]);

    const missing = await checkFileExistence(meeting.attachments || []);
    if (missing.length > 0) {
      setMissingFiles(missing);
    }

    setCurrentStep(STEPS.SELECT_ATTACHMENTS);
  };

  const handleToggleAttachment = (attachmentId) => {
    setSelectedAttachments(prev => {
      if (prev.includes(attachmentId)) {
        return prev.filter(id => id !== attachmentId);
      }
      return [...prev, attachmentId];
    });
  };

  const handleSelectAllAttachments = () => {
    if (selectedMeeting) {
      const validAttachmentIds = selectedMeeting.attachments
        ?.filter(a => !missingFiles.some(m => m.id === a.id))
        .map(a => a.id) || [];
      setSelectedAttachments(validAttachmentIds);
    }
  };

  const handleClearAttachments = () => {
    setSelectedAttachments([]);
  };

  const handleToggleGroup = (groupId) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      }
      return [...prev, groupId];
    });
  };

  const handleSelectAllGroups = () => {
    if (selectedMeeting) {
      const groupIds = selectedMeeting.groups?.map(g => g.id) || [];
      setSelectedGroups(groupIds);
    }
  };

  const handleClearGroups = () => {
    setSelectedGroups([]);
  };

  const validateAndGoToReview = async () => {
    const warnings = [];

    if (selectedAttachments.length === 0) {
      toast.error('请至少选择一个附件');
      return;
    }

    if (selectedGroups.length === 0) {
      toast.error('请至少选择一个小组');
      return;
    }

    const selectedAtts = (selectedMeeting?.attachments || []).filter(
      a => selectedAttachments.includes(a.id)
    );
    const missing = await checkFileExistence(selectedAtts);
    if (missing.length > 0) {
      setMissingFiles(missing);
      toast.error(`有 ${missing.length} 个文件不存在，请检查`);
      return;
    }

    const draftDispatch = {
      meetingId: selectedMeeting.id,
      attachmentIds: selectedAttachments,
      groupIds: selectedGroups,
    };

    const duplicates = validators.checkDuplicateDispatch(
      draftDispatch,
      dispatches,
      meetings
    );
    setDuplicateWarnings(duplicates);

    setCurrentStep(STEPS.REVIEW);
  };

  const handleCreateDispatch = async (status = DISPATCH_STATUS.PENDING) => {
    const dispatchData = {
      id: generateId(),
      meetingId: selectedMeeting.id,
      meetingTitle: selectedMeeting.title,
      meetingDate: selectedMeeting.date,
      attachmentIds: selectedAttachments,
      attachments: (selectedMeeting.attachments || []).filter(a => selectedAttachments.includes(a.id)),
      groupIds: selectedGroups,
      groups: (selectedMeeting.groups || []).filter(g => selectedGroups.includes(g.id)),
      notes: dispatchNotes,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewedAt: status === DISPATCH_STATUS.REVIEWING ? new Date().toISOString() : null,
      confirmedAt: status === DISPATCH_STATUS.CONFIRMED ? new Date().toISOString() : null,
      sentAt: status === DISPATCH_STATUS.SENT ? new Date().toISOString() : null,
    };

    const updatedDispatches = [...dispatches, dispatchData];
    const saved = await dataStore.saveDispatches(updatedDispatches);

    if (saved) {
      toast.success(status === DISPATCH_STATUS.SENT ? '分发记录已标记为已发送' : '分发记录已创建');
      resetForm();
      await refreshData();
    } else {
      toast.error('保存失败，请重试');
    }
  };

  const resetForm = () => {
    setCurrentStep(STEPS.SELECT_MEETING);
    setSelectedMeeting(null);
    setSelectedAttachments([]);
    setSelectedGroups([]);
    setDispatchNotes('');
    setWarnings([]);
    setMissingFiles([]);
    setDuplicateWarnings([]);
  };

  const renderStepIndicator = () => {
    const steps = [
      { step: STEPS.SELECT_MEETING, title: '选择会议' },
      { step: STEPS.SELECT_ATTACHMENTS, title: '选择附件' },
      { step: STEPS.SELECT_GROUPS, title: '选择小组' },
      { step: STEPS.REVIEW, title: '复核确认' },
    ];

    return (
      <div className="step-indicator mb-4">
        {steps.map((s, idx) => (
          <div
            key={s.step}
            className={`step ${currentStep === s.step ? 'active' : ''} ${currentStep > s.step ? 'completed' : ''}`}
          >
            <div className="step-line"></div>
            <div className="step-circle">
              {currentStep > s.step ? '✓' : idx + 1}
            </div>
            <div className="step-title">{s.title}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="card">
      <div className="card-header">
        <h3>请选择要分发的会议</h3>
      </div>
      <div className="card-body">
        {meetingsWithAttachments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">暂无可用会议</div>
            <div className="empty-state-message">
              请先在「会议管理」中创建会议并添加附件
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>会议标题</th>
                <th>日期</th>
                <th>附件数</th>
                <th>小组数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {meetingsWithAttachments.map(meeting => (
                <tr key={meeting.id}>
                  <td className="font-bold">{meeting.title}</td>
                  <td>{meeting.date}</td>
                  <td>
                    <span className="badge badge-primary">
                      {meeting.attachments.length} 个
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-success">
                      {meeting.groups?.length || 0} 组
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleSelectMeeting(meeting)}
                    >
                      选择此会议
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => {
    const attachments = selectedMeeting?.attachments || [];

    return (
      <div className="card">
        <div className="card-header">
          <div className="d-flex justify-between align-center" style={{ width: '100%' }}>
            <h3>会议：{selectedMeeting?.title}</h3>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-default" onClick={resetForm}>
                ← 返回选择会议
              </button>
            </div>
          </div>
        </div>
        <div className="card-body">
          {missingFiles.length > 0 && (
            <div className="alert alert-error mb-4">
              <span className="alert-icon">⚠️</span>
              <div className="alert-content">
                <div className="alert-title">文件缺失警告</div>
                <div className="alert-message">
                  以下文件路径不存在，请先在会议管理中修复：
                  <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    {missingFiles.map((f, i) => (
                      <li key={i}>{f.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="d-flex justify-between align-center mb-4">
            <div className="text-muted">
              已选择 <span className="font-bold text-primary">{selectedAttachments.length}</span> / {attachments.length} 个附件
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-default" onClick={handleClearAttachments}>
                清空
              </button>
              <button className="btn btn-sm btn-primary" onClick={handleSelectAllAttachments}>
                全选
              </button>
            </div>
          </div>

          {attachments.map(attachment => {
            const isMissing = missingFiles.some(f => f.id === attachment.id);
            const isSelected = selectedAttachments.includes(attachment.id);
            return (
              <div
                key={attachment.id}
                className={`file-item ${isSelected ? 'selected' : ''}`}
                style={{
                  cursor: isMissing ? 'not-allowed' : 'pointer',
                  opacity: isMissing ? 0.5 : 1,
                  border: isSelected ? '2px solid #1890ff' : 'none',
                }}
                onClick={() => !isMissing && handleToggleAttachment(attachment.id)}
              >
                <div className="file-item-icon">
                  {getFileIcon(attachment.name)}
                </div>
                <div className="file-item-info">
                  <div className="file-item-name">{attachment.name}</div>
                  <div className="file-item-meta">
                    {formatFileSize(attachment.size)} · {attachment.filePath}
                    {isMissing && (
                      <span className="text-danger" style={{ marginLeft: '8px' }}>
                        ⚠️ 文件不存在
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => !isMissing && handleToggleAttachment(attachment.id)}
                    disabled={isMissing}
                    style={{ width: '20px', height: '20px', cursor: isMissing ? 'not-allowed' : 'pointer' }}
                  />
                </div>
              </div>
            );
          })}

          <div className="mt-4 d-flex justify-end">
            <button
              className="btn btn-primary"
              disabled={selectedAttachments.length === 0}
              onClick={() => setCurrentStep(STEPS.SELECT_GROUPS)}
            >
              下一步：选择小组 →
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    const groups = selectedMeeting?.groups || [];

    return (
      <div className="card">
        <div className="card-header">
          <div className="d-flex justify-between align-center" style={{ width: '100%' }}>
            <h3>选择接收小组</h3>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-default" onClick={() => setCurrentStep(STEPS.SELECT_ATTACHMENTS)}>
                ← 上一步
              </button>
            </div>
          </div>
        </div>
        <div className="card-body">
          {groups.length === 0 ? (
            <div className="alert alert-warning">
              <span className="alert-icon">⚠️</span>
              <div className="alert-content">
                <div className="alert-title">该会议还没有配置小组</div>
                <div className="alert-message">
                  请先在会议管理中添加接收小组
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="d-flex justify-between align-center mb-4">
                <div className="text-muted">
                  已选择 <span className="font-bold text-primary">{selectedGroups.length}</span> / {groups.length} 个小组
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-default" onClick={handleClearGroups}>
                    清空
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={handleSelectAllGroups}>
                    全选
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                {groups.map(group => {
                  const isSelected = selectedGroups.includes(group.id);
                  return (
                    <div
                      key={group.id}
                      className="file-item"
                      style={{
                        cursor: 'pointer',
                        border: isSelected ? '2px solid #1890ff' : 'none',
                      }}
                      onClick={() => handleToggleGroup(group.id)}
                    >
                      <div className="file-item-icon" style={{ fontSize: '20px' }}>
                        👥
                      </div>
                      <div className="file-item-info">
                        <div className="file-item-name">{group.name}</div>
                        <div className="file-item-meta">
                          {group.members?.length || 0} 名成员
                          {group.members?.length > 0 && (
                            <span style={{ marginLeft: '8px' }}>
                              ({group.members.join('、')})
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleGroup(group.id)}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-4 d-flex justify-end">
            <button
              className="btn btn-primary"
              disabled={selectedGroups.length === 0}
              onClick={validateAndGoToReview}
            >
              下一步：复核确认 →
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderStep4 = () => {
    const selectedAtts = (selectedMeeting?.attachments || []).filter(
      a => selectedAttachments.includes(a.id)
    );
    const selectedGrps = (selectedMeeting?.groups || []).filter(
      g => selectedGroups.includes(g.id)
    );

    return (
      <div>
        <div className="card">
          <div className="card-header">
            <div className="d-flex justify-between align-center" style={{ width: '100%' }}>
              <h3>📋 分发复核</h3>
              <button className="btn btn-sm btn-default" onClick={() => setCurrentStep(STEPS.SELECT_GROUPS)}>
                ← 上一步
              </button>
            </div>
          </div>
          <div className="card-body">
            {duplicateWarnings.length > 0 && (
              <div className="alert alert-warning mb-4">
                <span className="alert-icon">⚠️</span>
                <div className="alert-content">
                  <div className="alert-title">重复分发警告</div>
                  <div className="alert-message">
                    {duplicateWarnings.map((w, i) => (
                      <div key={i} style={{ marginBottom: i < duplicateWarnings.length - 1 ? '8px' : 0 }}>
                        {w.message}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="row">
              <div className="col-6">
                <div className="form-group">
                  <label className="font-bold">会议信息</label>
                  <div className="card" style={{ marginBottom: 0 }}>
                    <div className="card-body" style={{ padding: '16px' }}>
                      <div className="font-bold">{selectedMeeting?.title}</div>
                      <div className="text-muted mt-2">
                        日期：{selectedMeeting?.date}
                      </div>
                      {selectedMeeting?.location && (
                        <div className="text-muted">
                          地点：{selectedMeeting.location}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-6">
                <div className="form-group">
                  <label className="font-bold">分发备注</label>
                  <textarea
                    className="form-control"
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    placeholder="可选：输入分发备注信息..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="divider"></div>

            <div className="row">
              <div className="col-6">
                <div className="form-group">
                  <label className="font-bold">
                    待分发附件 ({selectedAtts.length} 个)
                  </label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {selectedAtts.map(att => (
                      <div key={att.id} className="file-item" style={{ marginBottom: '8px', padding: '8px 12px' }}>
                        <div className="file-item-icon" style={{ fontSize: '16px' }}>
                          {getFileIcon(att.name)}
                        </div>
                        <div className="file-item-info">
                          <div className="file-item-name" style={{ fontSize: '13px' }}>
                            {att.name}
                          </div>
                          <div className="file-item-meta">
                            {formatFileSize(att.size)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-6">
                <div className="form-group">
                  <label className="font-bold">
                    接收小组 ({selectedGrps.length} 个)
                  </label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {selectedGrps.map(grp => (
                      <div key={grp.id} className="file-item" style={{ marginBottom: '8px', padding: '8px 12px' }}>
                        <div className="file-item-icon" style={{ fontSize: '16px' }}>
                          👥
                        </div>
                        <div className="file-item-info">
                          <div className="file-item-name" style={{ fontSize: '13px' }}>
                            {grp.name}
                          </div>
                          <div className="file-item-meta">
                            {grp.members?.length || 0} 人
                            {grp.members?.length > 0 && ` (${grp.members.join('、')})`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ padding: '20px' }}>
            <div className="d-flex justify-between align-center">
              <div className="text-muted">
                确认以上信息无误后，选择操作类型：
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-default"
                  onClick={resetForm}
                >
                  取消
                </button>
                <button
                  className="btn btn-warning"
                  onClick={() => handleCreateDispatch(DISPATCH_STATUS.PENDING)}
                >
                  保存为草稿
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleCreateDispatch(DISPATCH_STATUS.CONFIRMED)}
                >
                  ✓ 确认分发
                </button>
                <button
                  className="btn btn-success"
                  onClick={async () => {
                    const confirmed = await confirmAction(
                      '确认已经将附件发送给所有指定小组？点击确定后状态将标记为「已发送」。',
                      '确认发送'
                    );
                    if (confirmed) {
                      handleCreateDispatch(DISPATCH_STATUS.SENT);
                    }
                  }}
                >
                  📤 标记为已发送
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderStepIndicator()}

      {currentStep === STEPS.SELECT_MEETING && renderStep1()}
      {currentStep === STEPS.SELECT_ATTACHMENTS && renderStep2()}
      {currentStep === STEPS.SELECT_GROUPS && renderStep3()}
      {currentStep === STEPS.REVIEW && renderStep4()}
    </div>
  );
}

export default DispatchPage;
