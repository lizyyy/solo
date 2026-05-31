import { useState } from 'react';
import { useTimelineStore } from '@/store/useTimelineStore';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { X, Edit2, Save, Trash2, Clock, AlertCircle, CheckCircle, User, Scissors, Megaphone } from 'lucide-react';
import { formatTime, formatDateTime } from '@/utils/time';
import type { TimelineRecord, RecordStatus } from '@/types';

const statusOptions: { value: RecordStatus; label: string; variant: 'confirmed' | 'pending' | 'manual' }[] = [
  { value: 'confirmed', label: '已确认', variant: 'confirmed' },
  { value: 'pending', label: '待补', variant: 'pending' },
  { value: 'manual', label: '人工更正', variant: 'manual' },
];

const typeIcons = {
  guest: User,
  clip: Scissors,
  ad: Megaphone,
};

const typeLabels = {
  guest: '嘉宾名单',
  clip: '剪辑点',
  ad: '广告口播',
};

export function RecordDetailPanel() {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<TimelineRecord>>({});

  const selectedRecordId = useTimelineStore(state => state.selectedRecordId);
  const selectRecord = useTimelineStore(state => state.selectRecord);
  const updateRecord = useTimelineStore(state => state.updateRecord);
  const deleteRecord = useTimelineStore(state => state.deleteRecord);
  const getRecordAnomalies = useTimelineStore(state => state.getRecordAnomalies);
  const getRecordCorrections = useTimelineStore(state => state.getRecordCorrections);
  const records = useTimelineStore(state => state.records);

  const record = records.find(r => r.id === selectedRecordId);
  const anomalies = selectedRecordId ? getRecordAnomalies(selectedRecordId) : [];
  const corrections = selectedRecordId ? getRecordCorrections(selectedRecordId) : [];
  const unresolvedAnomalies = anomalies.filter(a => !a.resolved);

  if (!record) {
    return (
      <div className="panel h-full flex items-center justify-center">
        <div className="text-center text-text-muted">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">点击时间轴上的条目查看详情</p>
        </div>
      </div>
    );
  }

  const Icon = typeIcons[record.type];

  const handleStartEdit = () => {
    setEditData({
      title: record.title,
      description: record.description,
      startTime: record.startTime,
      duration: record.duration,
      status: record.status,
      meta: { ...record.meta },
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateRecord(record.id, editData, '手动编辑');
    setIsEditing(false);
  };

  const handleStatusChange = (status: RecordStatus) => {
    if (isEditing) {
      setEditData(prev => ({ ...prev, status }));
    } else {
      updateRecord(record.id, { status }, `状态变更为: ${status}`);
    }
  };

  const handleDelete = () => {
    if (confirm(`确定删除记录"${record.title}"？此操作不可撤销。`)) {
      deleteRecord(record.id);
    }
  };

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-text-secondary" />
          <span>记录详情</span>
        </div>
        <div className="flex items-center gap-1">
          {!isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => selectRecord(null)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" size="sm" onClick={handleSave}>
                <Save className="w-3.5 h-3.5" />
                保存
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="panel-body flex-1 overflow-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="default">{typeLabels[record.type]}</Badge>
            <Badge variant={record.status}>
              {statusOptions.find(s => s.value === record.status)?.label}
            </Badge>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">
              标题
            </label>
            {isEditing ? (
              <input
                type="text"
                className="input-raw text-sm"
                value={editData.title}
                onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
              />
            ) : (
              <h3 className="text-lg font-medium text-text-primary">{record.title}</h3>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">
                开始时间
              </label>
              {isEditing ? (
                <input
                  type="number"
                  className="input-raw text-sm"
                  value={editData.startTime}
                  onChange={(e) => setEditData(prev => ({ ...prev, startTime: parseFloat(e.target.value) || 0 }))}
                />
              ) : (
                <p className="font-mono text-text-primary">{formatTime(record.startTime)}</p>
              )}
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">
                时长
              </label>
              {isEditing ? (
                <input
                  type="number"
                  className="input-raw text-sm"
                  value={editData.duration}
                  onChange={(e) => setEditData(prev => ({ ...prev, duration: parseFloat(e.target.value) || 0 }))}
                />
              ) : (
                <p className="font-mono text-text-primary">{formatTime(record.duration)}</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">
              描述
            </label>
            {isEditing ? (
              <textarea
                className="input-raw text-sm h-20 resize-none"
                value={editData.description}
                onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
              />
            ) : (
              <p className="text-sm text-text-secondary">{record.description || '无描述'}</p>
            )}
          </div>

          {record.meta && Object.keys(record.meta).length > 0 && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">
                元数据
              </label>
              <div className="space-y-1 text-xs">
                {record.meta.speakerName && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">嘉宾姓名</span>
                    <span className="text-text-secondary">{record.meta.speakerName}</span>
                  </div>
                )}
                {record.meta.adClient && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">广告客户</span>
                    <span className="text-text-secondary">{record.meta.adClient}</span>
                  </div>
                )}
                {record.meta.clipType && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">剪辑类型</span>
                    <span className="text-text-secondary">{record.meta.clipType}</span>
                  </div>
                )}
                {record.meta.importDelay && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">晚到时间</span>
                    <span className="text-status-pending">{record.meta.importDelay} 小时</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">
              状态变更
            </label>
            <div className="flex gap-2">
              {statusOptions.map(option => (
                <Button
                  key={option.value}
                  variant={(isEditing ? editData.status : record.status) === option.value ? 'primary' : 'secondary'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleStatusChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {unresolvedAnomalies.length > 0 && (
            <div className="p-3 border border-status-anomaly/30 bg-status-anomalyBg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-status-anomaly" />
                <span className="text-xs font-medium text-status-anomaly">存在未解决异常</span>
              </div>
              <div className="space-y-1">
                {unresolvedAnomalies.map(a => (
                  <p key={a.id} className="text-xs text-text-secondary">• {a.description}</p>
                ))}
              </div>
            </div>
          )}

          {corrections.length > 0 && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-2">
                更正历史 ({corrections.length})
              </label>
              <div className="space-y-2">
                {corrections.map(c => (
                  <div key={c.id} className="p-2 bg-bg-tertiary border border-border-primary text-xs">
                    <div className="flex justify-between mb-1">
                      <Badge variant="manual" className="text-[9px]">{c.fieldName}</Badge>
                      <span className="code-text text-text-muted">{formatDateTime(c.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="code-text text-status-anomaly line-through">{c.oldValue}</span>
                      <span className="text-text-muted">→</span>
                      <span className="code-text text-status-confirmed">{c.newValue}</span>
                    </div>
                    {c.reason && <p className="text-text-muted mt-1 text-[10px]">原因: {c.reason}</p>}
                    <p className="text-text-muted text-[10px]">操作人: {c.operator}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-border-primary text-[10px] text-text-muted space-y-1">
            <div className="flex justify-between">
              <span>记录ID</span>
              <span className="code-text">{record.id}</span>
            </div>
            <div className="flex justify-between">
              <span>创建时间</span>
              <span className="code-text">{formatDateTime(record.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>更新时间</span>
              <span className="code-text">{formatDateTime(record.updatedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>来源</span>
              <span>{record.source === 'manual' ? '人工添加' : '导入'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-border-primary bg-bg-tertiary">
        <Button variant="danger" size="sm" className="w-full text-xs" onClick={handleDelete}>
          <Trash2 className="w-3.5 h-3.5" />
          删除此记录
        </Button>
      </div>
    </div>
  );
}
