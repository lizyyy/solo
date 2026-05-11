import { useEffect, useState } from 'react';
import { Schedule, ScheduleStatus, Content, Screen, ContentType } from '../types';
import { scheduleStorage, contentStorage, screenStorage, historyStorage } from '../storage';
import { recordHistory } from '../services/history';
import { findConflicts, calculatePriority, validateSchedule } from '../services/scheduler';
import { v4 as uuidv4 } from 'uuid';

const STATUS_MAP: Record<ScheduleStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: '#9ca3af' },
  PENDING_REVIEW: { label: '待审核', color: '#eab308' },
  APPROVED: { label: '已通过', color: '#22c55e' },
  PUBLISHED: { label: '已发布', color: '#16a34a' },
  CANCELLED: { label: '已取消', color: '#ef4444' },
  REJECTED: { label: '已拒绝', color: '#dc2626' },
};

const TYPE_MAP: Record<ContentType, { label: string; color: string }> = {
  AD: { label: '广告', color: '#3b82f6' },
  ACTIVITY: { label: '活动', color: '#8b5cf6' },
  EMERGENCY: { label: '紧急', color: '#ef4444' },
};

interface ScheduleFormProps {
  schedule?: Schedule | null;
  onSave: (schedule: Schedule) => void;
  onCancel: () => void;
  isFrozen: boolean;
  mode: 'create' | 'edit' | 'emergency';
}

function ScheduleForm({ schedule, onSave, onCancel, isFrozen, mode }: ScheduleFormProps) {
  const [contents, setContents] = useState<Content[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [formData, setFormData] = useState<Partial<Schedule>>({
    contentId: schedule?.contentId || '',
    screenIds: schedule?.screenIds || [],
    startTime: schedule?.startTime || new Date(Date.now() + 60000).toISOString().slice(0, 16),
    endTime: schedule?.endTime || new Date(Date.now() + 3600000 * 24).toISOString().slice(0, 16),
    isEmergency: mode === 'emergency',
    priority: schedule?.priority || 20,
    notes: schedule?.notes || '',
  });
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'form' | 'review'>('form');

  useEffect(() => {
    setContents(contentStorage.getAll().filter(c => c.status !== 'ARCHIVED'));
    setScreens(screenStorage.getAll().filter(s => s.status === 'ACTIVE'));
  }, []);

  const selectedContent = contents.find(c => c.id === formData.contentId);
  const autoPriority = formData.contentId 
    ? calculatePriority(Boolean(formData.isEmergency), selectedContent?.type)
    : formData.priority || 20;

  useEffect(() => {
    if (formData.contentId && formData.screenIds?.length && formData.startTime && formData.endTime) {
      const draftSchedule: Schedule = {
        id: schedule?.id || 'temp',
        code: schedule?.code || 'TEMP',
        contentId: formData.contentId,
        screenIds: formData.screenIds,
        startTime: formData.startTime,
        endTime: formData.endTime,
        priority: autoPriority,
        status: 'DRAFT',
        isEmergency: Boolean(formData.isEmergency),
        createdAt: schedule?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: '系统管理员',
      };
      setConflicts(findConflicts(draftSchedule));
    } else {
      setConflicts([]);
    }
  }, [formData, autoPriority]);

  const handleScreenToggle = (screenId: string) => {
    const current = formData.screenIds || [];
    const newIds = current.includes(screenId)
      ? current.filter(id => id !== screenId)
      : [...current, screenId];
    setFormData({ ...formData, screenIds: newIds });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateSchedule(formData as any);
    if (!validation.valid) {
      setErrors(validation.errors);
      setStep('form');
      return;
    }

    if (conflicts.length > 0 && !formData.isEmergency) {
      setErrors([`存在 ${conflicts.length} 个冲突，请检查或确认强制覆盖`]);
      return;
    }

    setStep('review');
  };

  const handleConfirmSave = () => {
    const now = new Date().toISOString();
    const content = contents.find(c => c.id === formData.contentId);
    const scheduleCode = schedule?.code || `SCH-${Date.now().toString().slice(-8)}`;
    
    const newSchedule: Schedule = {
      id: schedule?.id || uuidv4(),
      code: scheduleCode,
      contentId: formData.contentId!,
      screenIds: formData.screenIds!,
      startTime: formData.startTime!,
      endTime: formData.endTime!,
      priority: autoPriority,
      status: mode === 'emergency' ? 'PUBLISHED' : (schedule?.status || 'DRAFT'),
      isEmergency: Boolean(formData.isEmergency),
      notes: formData.notes,
      createdAt: schedule?.createdAt || now,
      updatedAt: now,
      createdBy: schedule?.createdBy || '系统管理员',
    };

    onSave(newSchedule);
  };

  if (isFrozen && mode !== 'emergency') {
    return (
      <div className="modal-content">
        <div className="frozen-banner">系统已发布冻结，仅可创建紧急排期</div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>关闭</button>
        </div>
      </div>
    );
  }

  const title = mode === 'emergency' ? '紧急插播' : (schedule ? '编辑排期' : '新建排期');

  return (
    <div className="modal-content large">
      <h2>{title}</h2>
      {mode === 'emergency' && (
        <div className="warning-box" style={{ background: '#fef2f2', borderColor: '#ef4444', color: '#991b1b' }}>
          ⚠️ 紧急插播：将立即发布，最高优先级，覆盖所有普通排期
        </div>
      )}
      
      {step === 'form' ? (
        <>
          {errors.length > 0 && (
            <div className="error-box">
              {errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
          
          {conflicts.length > 0 && (
            <div className="conflict-box">
              <h4>⚠️ 检测到 {conflicts.length} 个潜在冲突</h4>
              {conflicts.map((c, idx) => {
                const conflictScreen = screens.find(s => s.id === c.screenId);
                const conflictContent = contentStorage.getById(c.schedule2.contentId);
                return (
                  <div key={idx} className="conflict-item">
                    <div><strong>屏幕：</strong>{conflictScreen?.name || c.screenId}</div>
                    <div><strong>类型：</strong>{c.type === 'PRIORITY_CONFLICT' ? '优先级冲突（无法覆盖）' : '时间重叠'}</div>
                    <div><strong>冲突内容：</strong>{conflictContent?.title || c.schedule2.code}</div>
                    <div><strong>时间：</strong>{new Date(c.schedule2.startTime).toLocaleString()} - {new Date(c.schedule2.endTime).toLocaleString()}</div>
                    <div><strong>说明：</strong>{c.description}</div>
                  </div>
                );
              })}
              {formData.isEmergency && <div className="conflict-hint">🚨 紧急排期将强制覆盖所有冲突</div>}
            </div>
          )}

          <div className="form-grid">
            <div className="form-row">
              <label>选择内容 *</label>
              <select 
                value={formData.contentId} 
                onChange={e => setFormData({ ...formData, contentId: e.target.value })}
              >
                <option value="">-- 请选择内容 --</option>
                {contents.map(c => (
                  <option key={c.id} value={c.id}>
                    [{TYPE_MAP[c.type].label}] {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label>是否紧急</label>
              <div className="checkbox-row">
                <input
                  type="checkbox"
                  checked={formData.isEmergency}
                  disabled={mode === 'emergency'}
                  onChange={e => setFormData({ ...formData, isEmergency: e.target.checked })}
                />
                <span>标记为紧急排期（优先级最高）</span>
              </div>
              {formData.isEmergency && (
                <div className="priority-badge">计算优先级：{autoPriority}（最高级）</div>
              )}
            </div>

            <div className="form-row">
              <label>开始时间 *</label>
              <input
                type="datetime-local"
                value={formData.startTime?.slice(0, 16)}
                onChange={e => setFormData({ ...formData, startTime: new Date(e.target.value).toISOString() })}
              />
            </div>

            <div className="form-row">
              <label>结束时间 *</label>
              <input
                type="datetime-local"
                value={formData.endTime?.slice(0, 16)}
                onChange={e => setFormData({ ...formData, endTime: new Date(e.target.value).toISOString() })}
              />
            </div>

            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label>选择屏幕 *（已选 {formData.screenIds?.length || 0} 台）</label>
              <div className="screen-select-grid">
                {screens.length === 0 ? (
                  <p style={{ color: '#888', gridColumn: '1 / -1' }}>暂无可用的运行中屏幕，请先在屏幕管理中添加</p>
                ) : (
                  screens.map(s => (
                    <label key={s.id} className={`screen-select-item ${formData.screenIds?.includes(s.id) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={formData.screenIds?.includes(s.id)}
                        onChange={() => handleScreenToggle(s.id)}
                      />
                      <div>
                        <div className="screen-name">{s.name}</div>
                        <div className="screen-meta">{s.location} | {s.orientation === 'LANDSCAPE' ? '横' : '竖'}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label>备注</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="可选：添加排期备注说明"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button onClick={onCancel}>取消</button>
            <button onClick={handleSubmit} className="primary">
              下一步：确认
            </button>
          </div>
        </>
      ) : (
        <div className="review-section">
          <h3>请确认排期信息</h3>
          <div className="review-grid">
            <div><strong>内容：</strong>{selectedContent?.title}</div>
            <div><strong>类型：</strong>{selectedContent ? TYPE_MAP[selectedContent.type].label : '-'}</div>
            <div><strong>紧急：</strong>{formData.isEmergency ? '是' : '否'}</div>
            <div><strong>优先级：</strong>{autoPriority}</div>
            <div><strong>开始时间：</strong>{new Date(formData.startTime!).toLocaleString()}</div>
            <div><strong>结束时间：</strong>{new Date(formData.endTime!).toLocaleString()}</div>
            <div><strong>屏幕数量：</strong>{formData.screenIds?.length} 台</div>
            <div><strong>状态：</strong>{mode === 'emergency' ? '立即发布' : '草稿'}</div>
          </div>
          {conflicts.length > 0 && (
            <div className="conflict-summary">
              ⚠️ 将覆盖 {conflicts.length} 个冲突排期
            </div>
          )}
          <div className="modal-actions">
            <button onClick={() => setStep('form')}>返回修改</button>
            <button onClick={handleConfirmSave} className="primary">
              确认{mode === 'emergency' ? '发布' : '保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ScheduleDetailProps {
  schedule: Schedule;
  onEdit: () => void;
  onClose: () => void;
  onAdvance: (newStatus: ScheduleStatus) => void;
  isFrozen: boolean;
}

function ScheduleDetail({ schedule, onEdit, onClose, onAdvance, isFrozen }: ScheduleDetailProps) {
  const [content, setContent] = useState<Content | null>(null);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);

  useEffect(() => {
    setContent(contentStorage.getById(schedule.contentId) || null);
    setScreens(screenStorage.getAll().filter(s => schedule.screenIds.includes(s.id)));
    setHistory(historyStorage.getByEntity('schedule', schedule.id));
    setConflicts(findConflicts(schedule));
  }, [schedule]);

  const canAdvance = () => {
    if (isFrozen && schedule.status !== 'PUBLISHED') return false;
    switch (schedule.status) {
      case 'DRAFT': return true;
      case 'PENDING_REVIEW': return true;
      case 'APPROVED': return true;
      default: return false;
    }
  };

  const getNextAction = () => {
    switch (schedule.status) {
      case 'DRAFT': return { status: 'PENDING_REVIEW' as ScheduleStatus, label: '提交审核' };
      case 'PENDING_REVIEW': return { status: 'APPROVED' as ScheduleStatus, label: '审核通过' };
      case 'APPROVED': return { status: 'PUBLISHED' as ScheduleStatus, label: '发布' };
      default: return null;
    }
  };

  const nextAction = getNextAction();

  return (
    <div className="modal-content large">
      <h2>排期详情</h2>
      
      <div className="detail-header">
        <span className="schedule-code">{schedule.code}</span>
        <span className="status-badge" style={{ backgroundColor: STATUS_MAP[schedule.status].color }}>
          {STATUS_MAP[schedule.status].label}
        </span>
        {schedule.isEmergency && (
          <span className="emergency-badge">🚨 紧急</span>
        )}
      </div>

      <div className="detail-grid">
        <div><strong>内容：</strong>{content?.title || '(已删除)'}</div>
        <div><strong>内容类型：</strong>{content ? TYPE_MAP[content.type].label : '-'}</div>
        <div><strong>优先级：</strong>{schedule.priority}</div>
        <div><strong>紧急排期：</strong>{schedule.isEmergency ? '是' : '否'}</div>
        <div><strong>开始时间：</strong>{new Date(schedule.startTime).toLocaleString()}</div>
        <div><strong>结束时间：</strong>{new Date(schedule.endTime).toLocaleString()}</div>
        <div><strong>创建人：</strong>{schedule.createdBy}</div>
        <div><strong>创建时间：</strong>{new Date(schedule.createdAt).toLocaleString()}</div>
      </div>

      {schedule.notes && (
        <div className="notes-box">
          <strong>备注：</strong>{schedule.notes}
        </div>
      )}

      <h3 style={{ marginTop: '16px' }}>投放屏幕（{screens.length} 台）</h3>
      <div className="screens-list">
        {screens.map(s => (
          <div key={s.id} className="screen-item">
            <div className="screen-name">{s.name}</div>
            <div className="screen-meta">{s.code} | {s.location}</div>
          </div>
        ))}
      </div>

      {conflicts.length > 0 && (
        <>
          <h3 style={{ marginTop: '16px', color: '#dc2626' }}>⚠️ 当前冲突（{conflicts.length}）</h3>
          <div className="conflict-list">
            {conflicts.map((c, idx) => {
              const cScreen = screens.find(s => s.id === c.screenId) || { name: c.screenId };
              const cContent = contentStorage.getById(c.schedule2.contentId);
              return (
                <div key={idx} className="conflict-mini">
                  {cScreen.name} | {cContent?.title || c.schedule2.code} | {c.description}
                </div>
              );
            })}
          </div>
        </>
      )}

      <h3 style={{ marginTop: '16px' }}>变更历史</h3>
      {history.length === 0 ? (
        <p style={{ color: '#888' }}>暂无变更记录</p>
      ) : (
        <div className="history-list">
          {history.map(h => (
            <div key={h.id} className="history-item">
              <div className="history-header">
                <span className="history-action">{h.action}</span>
                <span className="history-time">{new Date(h.timestamp).toLocaleString()}</span>
                <span className="history-operator">操作人：{h.operator}</span>
              </div>
              <div className="history-desc">{h.description}</div>
            </div>
          ))}
        </div>
      )}

      <div className="modal-actions">
        <button onClick={onClose}>关闭</button>
        {schedule.status !== 'PUBLISHED' && schedule.status !== 'CANCELLED' && schedule.status !== 'REJECTED' && !isFrozen && (
          <button onClick={onEdit}>编辑</button>
        )}
        {schedule.status !== 'CANCELLED' && schedule.status !== 'REJECTED' && schedule.status !== 'PUBLISHED' && !isFrozen && (
          <button className="danger" onClick={() => onAdvance('CANCELLED')}>撤销排期</button>
        )}
        {nextAction && canAdvance() && (
          <button className="primary" onClick={() => onAdvance(nextAction.status)}>
            {nextAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  isFrozen: boolean;
  toggleFrozen: (reason?: string) => void;
}

export default function ScheduleManagement({ isFrozen, toggleFrozen }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'emergency'>('create');
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [viewingSchedule, setViewingSchedule] = useState<Schedule | null>(null);
  const [filter, setFilter] = useState<{
    keyword: string;
    status: string;
    screenId: string;
    isEmergency: string;
    dateRange: string;
  }>({ keyword: '', status: '', screenId: '', isEmergency: '', dateRange: '' });
  
  const [screens, setScreens] = useState<Screen[]>([]);
  const [contents, setContents] = useState<Content[]>([]);

  useEffect(() => {
    setSchedules(scheduleStorage.getAll());
    setScreens(screenStorage.getAll());
    setContents(contentStorage.getAll());
  }, []);

  const filteredSchedules = schedules.filter(s => {
    const matchKeyword = !filter.keyword || 
      s.code.includes(filter.keyword) ||
      contents.find(c => c.id === s.contentId)?.title.includes(filter.keyword);
    const matchStatus = !filter.status || s.status === filter.status;
    const matchScreen = !filter.screenId || s.screenIds.includes(filter.screenId);
    const matchEmergency = filter.isEmergency === '' || (filter.isEmergency === 'yes' ? s.isEmergency : !s.isEmergency);
    
    let matchDate = true;
    if (filter.dateRange === 'today') {
      const today = new Date().toDateString();
      matchDate = new Date(s.startTime).toDateString() === today || new Date(s.endTime).toDateString() === today;
    } else if (filter.dateRange === 'week') {
      const now = Date.now();
      const week = 7 * 24 * 3600000;
      matchDate = new Date(s.startTime).getTime() <= now + week;
    }
    
    return matchKeyword && matchStatus && matchScreen && matchEmergency && matchDate;
  });

  const stats = {
    total: schedules.length,
    published: schedules.filter(s => s.status === 'PUBLISHED').length,
    pending: schedules.filter(s => s.status === 'PENDING_REVIEW' || s.status === 'APPROVED').length,
    emergency: schedules.filter(s => s.isEmergency && s.status === 'PUBLISHED').length,
    conflicts: schedules.reduce((acc, s) => acc + findConflicts(s).length, 0),
  };

  const handleSave = (newSchedule: Schedule) => {
    const allSchedules = scheduleStorage.getAll();
    const isNew = !editingSchedule;
    
    if (isNew) {
      allSchedules.push(newSchedule);
      const action = newSchedule.status === 'PUBLISHED' ? 'publish' : 'create';
      recordHistory('schedule', newSchedule.id, action as any, 
        `${newSchedule.isEmergency ? '紧急' : ''}创建排期 ${newSchedule.code}，状态：${STATUS_MAP[newSchedule.status].label}`, 
        null, newSchedule);
    } else {
      const oldSchedule = allSchedules.find(s => s.id === newSchedule.id);
      const idx = allSchedules.findIndex(s => s.id === newSchedule.id);
      if (idx >= 0) allSchedules[idx] = newSchedule;
      recordHistory('schedule', newSchedule.id, 'update', `更新排期 ${newSchedule.code}`, oldSchedule, newSchedule);
    }
    
    scheduleStorage.save(allSchedules);
    setSchedules(allSchedules);
    setShowForm(false);
    setEditingSchedule(null);
  };

  const handleStatusChange = (scheduleId: string, newStatus: ScheduleStatus) => {
    const allSchedules = scheduleStorage.getAll();
    const idx = allSchedules.findIndex(s => s.id === scheduleId);
    if (idx < 0) return;
    
    const oldSchedule = { ...allSchedules[idx] };
    allSchedules[idx] = {
      ...allSchedules[idx],
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
    
    const actionMap: Partial<Record<ScheduleStatus, 'approve' | 'reject' | 'publish' | 'cancel'>> = {
      APPROVED: 'approve',
      REJECTED: 'reject',
      PUBLISHED: 'publish',
      CANCELLED: 'cancel',
    };
    const action = actionMap[newStatus] || 'update';
    const descMap: Record<ScheduleStatus, string> = {
      DRAFT: '退回草稿',
      PENDING_REVIEW: '提交审核',
      APPROVED: '审核通过',
      PUBLISHED: '已发布',
      CANCELLED: '已撤销',
      REJECTED: '已拒绝',
    };
    
    recordHistory('schedule', scheduleId, action as any, 
      `排期 ${oldSchedule.code} ${descMap[newStatus]}`, 
      oldSchedule, allSchedules[idx]);
    
    scheduleStorage.save(allSchedules);
    setSchedules(allSchedules);
    
    if (viewingSchedule?.id === scheduleId) {
      setViewingSchedule(allSchedules[idx]);
    }
  };

  const handleDelete = (schedule: Schedule) => {
    if (isFrozen) {
      alert('系统已发布冻结，无法删除');
      return;
    }
    if (!confirm(`确定删除排期 "${schedule.code}" 吗？`)) return;
    
    const allSchedules = scheduleStorage.getAll().filter(s => s.id !== schedule.id);
    scheduleStorage.save(allSchedules);
    setSchedules(allSchedules);
    recordHistory('schedule', schedule.id, 'delete', `删除排期 ${schedule.code}`, schedule, null);
  };

  const handleExport = () => {
    const data = filteredSchedules.map(s => {
      const content = contents.find(c => c.id === s.contentId);
      const screenNames = screens
        .filter(sc => s.screenIds.includes(sc.id))
        .map(sc => sc.name)
        .join(', ');
      return {
        排期编号: s.code,
        内容标题: content?.title || '',
        内容类型: content ? TYPE_MAP[content.type].label : '',
        投放屏幕: screenNames,
        开始时间: new Date(s.startTime).toLocaleString(),
        结束时间: new Date(s.endTime).toLocaleString(),
        优先级: s.priority,
        是否紧急: s.isEmergency ? '是' : '否',
        状态: STATUS_MAP[s.status].label,
        创建人: s.createdBy,
        备注: s.notes || '',
      };
    });
    
    const headers = Object.keys(data[0] || {}).join(',');
    const rows = data.map(r => Object.values(r).map(v => `"${v}"`).join(','));
    const csv = [headers, ...rows].join('\n');
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `排期导出_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>内容排期管理</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleExport}>导出CSV</button>
          {!isFrozen && (
            <>
              <button onClick={() => { setFormMode('create'); setEditingSchedule(null); setShowForm(true); }}>
                + 新建排期
              </button>
              <button className="emergency" onClick={() => { setFormMode('emergency'); setEditingSchedule(null); setShowForm(true); }}>
                🚨 紧急插播
              </button>
            </>
          )}
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">总排期</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.published}</div>
          <div className="stat-label">已发布</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">待处理</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{stats.emergency}</div>
          <div className="stat-label">紧急排期</div>
        </div>
        <div className={`stat-card ${stats.conflicts > 0 ? 'danger' : ''}`}>
          <div className="stat-value">{stats.conflicts}</div>
          <div className="stat-label">冲突数</div>
        </div>
      </div>

      <div className="filter-bar">
        <input
          placeholder="搜索排期编号/内容标题"
          value={filter.keyword}
          onChange={e => setFilter({ ...filter, keyword: e.target.value })}
        />
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="PENDING_REVIEW">待审核</option>
          <option value="APPROVED">已通过</option>
          <option value="PUBLISHED">已发布</option>
          <option value="CANCELLED">已取消</option>
        </select>
        <select value={filter.screenId} onChange={e => setFilter({ ...filter, screenId: e.target.value })}>
          <option value="">全部屏幕</option>
          {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filter.isEmergency} onChange={e => setFilter({ ...filter, isEmergency: e.target.value })}>
          <option value="">全部类型</option>
          <option value="yes">仅紧急</option>
          <option value="no">仅普通</option>
        </select>
        <select value={filter.dateRange} onChange={e => setFilter({ ...filter, dateRange: e.target.value })}>
          <option value="">全部时间</option>
          <option value="today">今日</option>
          <option value="week">本周内</option>
        </select>
        <div className="stats">筛选结果：{filteredSchedules.length} 条</div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>排期编号</th>
            <th>内容</th>
            <th>时间范围</th>
            <th>屏幕数</th>
            <th>优先级</th>
            <th>紧急</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredSchedules.map(schedule => {
            const content = contents.find(c => c.id === schedule.contentId);
            const hasConflict = findConflicts(schedule).length > 0;
            return (
              <tr key={schedule.id} className={hasConflict ? 'has-conflict' : ''}>
                <td>{schedule.code}{hasConflict && <span className="conflict-dot">⚠️</span>}</td>
                <td>
                  {content && (
                    <div>
                      <div>{content.title}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        {TYPE_MAP[content.type].label}
                      </div>
                    </div>
                  )}
                </td>
                <td>
                  <div>{new Date(schedule.startTime).toLocaleString()}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    至 {new Date(schedule.endTime).toLocaleString()}
                  </div>
                </td>
                <td>{schedule.screenIds.length} 台</td>
                <td>{schedule.priority}</td>
                <td>
                  {schedule.isEmergency && <span className="emergency-dot">🚨</span>}
                </td>
                <td>
                  <span className="status-badge" style={{ backgroundColor: STATUS_MAP[schedule.status].color }}>
                    {STATUS_MAP[schedule.status].label}
                  </span>
                </td>
                <td className="actions">
                  <button onClick={() => setViewingSchedule(schedule)}>详情</button>
                  {schedule.status !== 'PUBLISHED' && schedule.status !== 'CANCELLED' && schedule.status !== 'REJECTED' && !isFrozen && (
                    <>
                      <button onClick={() => { setEditingSchedule(schedule); setFormMode('edit'); setShowForm(true); }}>
                        编辑
                      </button>
                      <button className="danger" onClick={() => handleDelete(schedule)}>删除</button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filteredSchedules.length === 0 && (
        <div className="empty-state">暂无排期数据，点击"新建排期"开始</div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => { setShowForm(false); setEditingSchedule(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <ScheduleForm
              schedule={editingSchedule}
              mode={formMode}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingSchedule(null); }}
              isFrozen={isFrozen}
            />
          </div>
        </div>
      )}

      {viewingSchedule && (
        <div className="modal-backdrop" onClick={() => setViewingSchedule(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <ScheduleDetail
              schedule={viewingSchedule}
              onEdit={() => { setViewingSchedule(null); setEditingSchedule(viewingSchedule); setFormMode('edit'); setShowForm(true); }}
              onClose={() => setViewingSchedule(null)}
              onAdvance={(status) => handleStatusChange(viewingSchedule.id, status)}
              isFrozen={isFrozen}
            />
          </div>
        </div>
      )}
    </div>
  );
}
