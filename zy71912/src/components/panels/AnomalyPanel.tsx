import { useState } from 'react';
import { useTimelineStore } from '@/store/useTimelineStore';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { AlertCircle, CheckCircle, Clock, Copy, X, MessageSquare, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/utils/time';
import type { AnomalyType, Anomaly } from '@/types';

const anomalyTypeLabels: Record<AnomalyType, string> = {
  duplicate: '重复项',
  late: '晚到附件',
  drift: '时间漂移',
  missing: '缺失字段',
};

const anomalyTypeColors: Record<AnomalyType, 'anomaly' | 'pending'> = {
  duplicate: 'anomaly',
  late: 'pending',
  drift: 'anomaly',
  missing: 'anomaly',
};

export function AnomalyPanel() {
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [explanationInput, setExplanationInput] = useState<Record<string, string>>({});

  const anomalies = useTimelineStore(state => state.anomalies);
  const records = useTimelineStore(state => state.records);
  const resolveAnomaly = useTimelineStore(state => state.resolveAnomaly);
  const updateAnomalyExplanation = useTimelineStore(state => state.updateAnomalyExplanation);
  const deleteRecord = useTimelineStore(state => state.deleteRecord);
  const setRecordStatus = useTimelineStore(state => state.setRecordStatus);
  const selectRecord = useTimelineStore(state => state.selectRecord);
  const selectedRecordId = useTimelineStore(state => state.selectedRecordId);

  const filteredAnomalies = anomalies.filter(a => {
    if (filter === 'unresolved') return !a.resolved;
    if (filter === 'resolved') return a.resolved;
    return true;
  }).sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return a.type.localeCompare(b.type);
  });

  const getRecord = (recordId: string) => records.find(r => r.id === recordId);

  const handleResolve = (anomaly: Anomaly) => {
    const explanation = explanationInput[anomaly.id] || anomaly.explanation;
    resolveAnomaly(anomaly.id, explanation);
    setExplanationInput(prev => ({ ...prev, [anomaly.id]: '' }));
  };

  const handleMergeDuplicate = (anomaly: Anomaly) => {
    if (!anomaly.relatedRecordIds || anomaly.relatedRecordIds.length < 2) return;
    const [keepId, ...deleteIds] = anomaly.relatedRecordIds;
    deleteIds.forEach(id => deleteRecord(id));
    setRecordStatus(keepId, 'confirmed');
    resolveAnomaly(anomaly.id, `合并重复项，保留记录 ${keepId}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border-primary flex items-center gap-2">
        <Button
          variant={filter === 'unresolved' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setFilter('unresolved')}
        >
          待处理 ({anomalies.filter(a => !a.resolved).length})
        </Button>
        <Button
          variant={filter === 'resolved' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setFilter('resolved')}
        >
          已解决 ({anomalies.filter(a => a.resolved).length})
        </Button>
        <Button
          variant={filter === 'all' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          全部 ({anomalies.length})
        </Button>
      </div>

      <div className="panel-body flex-1 overflow-auto">
        {filteredAnomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <CheckCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无{filter === 'unresolved' ? '待处理' : filter === 'resolved' ? '已解决' : ''}异常</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAnomalies.map((anomaly, index) => {
              const record = getRecord(anomaly.recordId);
              const isExpanded = expandedId === anomaly.id;
              if (!record) return null;

              return (
                <div
                  key={anomaly.id}
                  className={`border ${anomaly.resolved ? 'border-border-secondary opacity-70' : 'border-border-primary'} bg-bg-secondary animate-stagger`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div
                    className="p-3 cursor-pointer hover:bg-bg-tertiary/50"
                    onClick={() => setExpandedId(isExpanded ? null : anomaly.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {anomaly.resolved ? (
                          <CheckCircle className="w-4 h-4 text-status-confirmed" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-status-anomaly animate-pulse-slow" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={anomalyTypeColors[anomaly.type]}>
                            {anomalyTypeLabels[anomaly.type]}
                          </Badge>
                          {anomaly.type === 'late' && <Clock className="w-3.5 h-3.5 text-status-pending" />}
                          {anomaly.type === 'duplicate' && <Copy className="w-3.5 h-3.5 text-status-anomaly" />}
                          <span className="code-text text-text-muted text-[10px] ml-auto">
                            {record.type === 'guest' ? '嘉宾' : record.type === 'clip' ? '剪辑' : '广告'}
                          </span>
                        </div>
                        <p className="text-xs text-text-primary font-medium truncate">{record.title}</p>
                        <p className="text-xs text-text-muted mt-0.5">{anomaly.description}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-text-muted" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-text-muted" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-border-primary/50 pt-3">
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-text-muted">记录ID</span>
                          <span className="code-text text-text-secondary">{record.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">时间位置</span>
                          <span className="code-text text-text-secondary">
                            {Math.floor(record.startTime / 60)}:{(record.startTime % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">创建时间</span>
                          <span className="code-text text-text-secondary">{formatDateTime(record.createdAt)}</span>
                        </div>
                        {anomaly.explanation && (
                          <div className="mt-2 p-2 bg-bg-tertiary border border-border-primary">
                            <div className="flex items-center gap-1 text-text-muted mb-1">
                              <MessageSquare className="w-3 h-3" />
                              <span className="text-[10px]">异常解释</span>
                            </div>
                            <p className="text-text-secondary">{anomaly.explanation}</p>
                          </div>
                        )}
                        {anomaly.resolvedAt && (
                          <div className="flex justify-between">
                            <span className="text-text-muted">解决时间</span>
                            <span className="code-text text-text-secondary">{formatDateTime(anomaly.resolvedAt)}</span>
                          </div>
                        )}
                      </div>

                      {!anomaly.resolved && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            className="input-raw h-16 resize-none text-xs"
                            placeholder="添加异常解释说明..."
                            value={explanationInput[anomaly.id] || ''}
                            onChange={(e) => setExplanationInput(prev => ({ ...prev, [anomaly.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleResolve(anomaly)}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              标记已解决
                            </Button>
                            {anomaly.type === 'duplicate' && anomaly.relatedRecordIds && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleMergeDuplicate(anomaly)}
                              >
                                合并重复
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                selectRecord(anomaly.recordId);
                                setExpandedId(null);
                              }}
                            >
                              定位
                            </Button>
                          </div>
                        </div>
                      )}

                      {selectedRecordId === anomaly.recordId && anomaly.resolved && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1"
                            onClick={() => selectRecord(null)}
                          >
                            取消选中
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              if (confirm('确定删除此记录？')) {
                                deleteRecord(anomaly.recordId);
                                setExpandedId(null);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-border-primary bg-bg-tertiary">
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>时间轴漂移：点击时间轴上橘红色区域查看详情</span>
          <Button variant="ghost" size="sm" onClick={() => setExpandedId(null)}>
            <X className="w-3 h-3" />
            收起全部
          </Button>
        </div>
      </div>
    </div>
  );
}
