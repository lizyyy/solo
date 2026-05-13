import React, { useState } from 'react';
import { Case, Lawyer, getStatusLabel, getStatusColor, getDomainLabel, getPriorityLabel, getPriorityColor, CASE_STATUSES } from '../types';

interface CaseDetailProps {
  caseData: Case | null;
  lawyers: Lawyer[];
  onClose: () => void;
  onUpdateCase: (id: string, data: Partial<Case>) => void;
  onChangeStatus: (id: string, data: { new_status: string; changed_by: string; change_reason?: string }) => void;
  onCheckConflict: (id: string, data: { opposing_party: string; checked_by: string }) => void;
  onAssignLawyer: (data: { case_id: string; lawyer_id: string; assigned_by: string }) => void;
  onReassignCase: (data: { case_id: string; to_lawyer_id: string; reason: string; reassigned_by: string; follow_up_required?: boolean }) => void;
  onCompleteFollowUp: (reassignmentId: string, data: { follow_up_note: string; completed_by: string }) => void;
}

const CaseDetail: React.FC<CaseDetailProps> = ({
  caseData, lawyers, onClose, onUpdateCase, onChangeStatus, onCheckConflict, onAssignLawyer, onReassignCase, onCompleteFollowUp }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [selectedLawyer, setSelectedLawyer] = useState('');
  const [reassignLawyer, setReassignLawyer] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [conflictOpposingParty, setConflictOpposingParty] = useState(caseData?.opposing_party || '');
  const [conflictResult, setConflictResult] = useState<{ has_conflict: boolean; details: string } | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');

  if (!caseData) return null;

  const handleChangeStatus = () => {
    if (!newStatus) return;
    onChangeStatus(caseData.id, {
      new_status: newStatus,
      changed_by: '当前用户',
      change_reason: statusReason
    });
    setNewStatus('');
    setStatusReason('');
  };

  const handleAssignLawyer = () => {
    if (!selectedLawyer) return;
    onAssignLawyer({
      case_id: caseData.id,
      lawyer_id: selectedLawyer,
      assigned_by: '当前用户'
    });
    setSelectedLawyer('');
  };

  const handleReassignCase = () => {
    if (!reassignLawyer || !reassignReason) return;
    onReassignCase({
      case_id: caseData.id,
      to_lawyer_id: reassignLawyer,
      reason: reassignReason,
      reassigned_by: '当前用户',
      follow_up_required: followUpRequired
    });
    setReassignLawyer('');
    setReassignReason('');
    setFollowUpRequired(false);
  };

  const handleCheckConflict = async () => {
    const result = await onCheckConflict(caseData.id, {
      opposing_party: conflictOpposingParty,
      checked_by: '当前用户'
    });
    setConflictResult(result);
  };

  const tabs = [
    { id: 'info', label: '基本信息' },
    { id: 'history', label: '状态历史' },
    { id: 'modifications', label: '修改记录' },
    { id: 'conflict', label: '冲突检查' },
    { id: 'reassign', label: '转派回访' }
  ];

  const fieldLabels: Record<string, string> = {
    title: '标题',
    opposing_party: '对方主体',
    case_domain: '案件领域',
    priority: '优先级'
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h2>案件详情 - {caseData.case_number}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>案件标题</label>
                <div style={{ fontWeight: 500 }}>{caseData.title}</div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>对方主体</label>
                <div style={{ fontWeight: 500 }}>{caseData.opposing_party}</div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>案件领域</label>
                <span className="badge badge-primary">{getDomainLabel(caseData.case_domain)}</span>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>优先级</label>
                <span className="badge" style={{ background: getPriorityColor(caseData.priority) + '20', color: getPriorityColor(caseData.priority) }}>
                  {getPriorityLabel(caseData.priority)}
                </span>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>状态</label>
                <span className="badge" style={{ background: getStatusColor(caseData.status) + '20', color: getStatusColor(caseData.status) }}>
                  {getStatusLabel(caseData.status)}
                </span>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>指派律师</label>
                <div style={{ fontWeight: 500 }}>{caseData.assigned_lawyer_name || '未指派'}</div>
              </div>
            </div>

            <div className="form-group">
              <label>变更状态</label>
              <div className="flex gap-2">
                <select
                  className="form-control"
                  style={{ flex: 1 }}
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="">选择新状态</option>
                  {CASE_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="form-control"
                  style={{ flex: 1 }}
                  placeholder="变更原因"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleChangeStatus} disabled={!newStatus}>
                  变更
                </button>
              </div>
            </div>

            {!caseData.assigned_lawyer_id ? (
              <div className="form-group">
                <label>指派律师</label>
                <div className="flex gap-2">
                  <select
                    className="form-control"
                    style={{ flex: 1 }}
                    value={selectedLawyer}
                    onChange={(e) => setSelectedLawyer(e.target.value)}
                  >
                    <option value="">选择律师</option>
                    {lawyers.filter(l => l.current_load < l.capacity).map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.current_load}/{l.capacity})</option>
                    ))}
                  </select>
                  <button className="btn btn-success" onClick={handleAssignLawyer} disabled={!selectedLawyer}>
                    指派
                  </button>
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label>转派律师</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select
                    className="form-control"
                    value={reassignLawyer}
                    onChange={(e) => setReassignLawyer(e.target.value)}
                  >
                    <option value="">选择新律师</option>
                    {lawyers.filter(l => l.current_load < l.capacity && l.id !== caseData.assigned_lawyer_id).map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.current_load}/{l.capacity})</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="转派原因"
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={followUpRequired}
                      onChange={(e) => setFollowUpRequired(e.target.checked)}
                    />
                    需要回访
                  </label>
                  <button
                    className="btn btn-primary" onClick={handleReassignCase} disabled={!reassignLawyer || !reassignReason}>
                    转派
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {!caseData.status_history || caseData.status_history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">暂无状态变更记录</div>
              </div>
            ) : (
              <ul className="timeline">
                {caseData.status_history.map((h, i) => (
                  <li key={i} className="timeline-item">
                    <div className="timeline-date">{new Date(h.created_at).toLocaleString()}</div>
                    <div className="timeline-content">
                      {h.previous_status ? (
                        <span>
                      <span style={{ color: '#dc3545' }}>{getStatusLabel(h.previous_status)}</span>
                      {' → '}
                      <span style={{ color: '#28a745' }}>{getStatusLabel(h.new_status)}</span>
                    </span>
                    ) : (
                      <span>创建案件，状态: <span style={{ color: '#28a745' }}>{getStatusLabel(h.new_status)}</span></span>
                    )}
                  </div>
                    <div className="timeline-meta">
                      操作人: {h.changed_by}
                      {h.change_reason && ` · 原因: ${h.change_reason}}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'modifications' && (
          <div>
            {!caseData.modifications || caseData.modifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">暂无修改记录</div>
              </div>
            ) : (
              caseData.modifications.map((m, i) => (
                <div key={i} className="modification-item">
                  <div className="modification-field">{fieldLabels[m.field_name] || m.field_name}</div>
                  <div className="modification-values">
                    {m.old_value && <span className="old-value">{m.old_value}</span>}
                    <span>→</span>
                    <span className="new-value">{m.new_value}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                    {m.modified_by} · {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'conflict' && (
          <div>
            <div className="form-group">
              <label>对方主体</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-control"
                  value={conflictOpposingParty}
                  onChange={(e) => setConflictOpposingParty(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleCheckConflict}>
                  检查冲突
                </button>
              </div>
            </div>

            {conflictResult && (
              <div className={`conflict-result ${conflictResult.has_conflict ? 'conflict' : 'no-conflict'}`}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                  {conflictResult.has_conflict ? '⚠️ 发现冲突' : '✓ 未发现冲突'}
                </div>
                <div>{conflictResult.details}</div>
              </div>
            )}

            {caseData.conflict_checks && caseData.conflict_checks.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>历史检查记录</h4>
                {caseData.conflict_checks.map((c, i) => (
                  <div key={i} className="modification-item">
                    <div style={{ fontWeight: 500 }}>
                      对方主体: {c.opposing_party}
                    </div>
                    <div style={{ marginTop: '5px' }}>
                      <span className={`badge ${c.check_result === 'conflict' ? 'badge-danger' : 'badge-success'}`}>
                        {c.check_result === 'conflict' ? '有冲突' : '无冲突'}
                      </span>
                    </div>
                    {c.conflict_details && (
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>{c.conflict_details}</div>
                    )}
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                      {c.checked_by} · {new Date(c.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reassign' && (
          <div>
            {!caseData.reassignments || caseData.reassignments.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">暂无转派记录</div>
              </div>
            ) : (
              caseData.reassignments.map((r, i) => (
                <div key={i} className="reassignment-item">
                  <div className="reassignment-reason">{r.reason}</div>
                  <div className="reassignment-flow">
                    <span>{r.from_lawyer_name || '首次指派'}</span>
                    <span className="reassignment-arrow">→</span>
                    <span style={{ fontWeight: 600 }}>{r.to_lawyer_name}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    转派人: {r.reassigned_by} · {new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.follow_up_required && (
                    <div style={{ marginTop: '10px' }}>
                      {r.follow_up_completed ? (
                        <div>
                          <span className="follow-up-badge follow-up-completed">✓ 已回访</span>
                          {r.follow_up_note && (
                            <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
                              回访备注: {r.follow_up_note}
                            </div>
                          )}
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                            {r.follow_up_by} · {r.follow_up_at && new Date(r.follow_up_at).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="follow-up-badge follow-up-required">⏰ 待回访</span>
                          <div style={{ marginTop: '10px' }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="填写回访记录"
                              value={followUpNote}
                              onChange={(e) => setFollowUpNote(e.target.value)}
                            />
                            <button
                              className="btn btn-sm btn-success"
                              style={{ marginTop: '10px' }}
                              onClick={() => {
                                onCompleteFollowUp(r.id, {
                                  follow_up_note: followUpNote,
                                  completed_by: '当前用户'
                                });
                                setFollowUpNote('');
                              }}
                            >
                              完成回访
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseDetail;
