import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, User, Edit3, Trash2, Music } from 'lucide-react';
import type { EvidenceChainItem, OperationType } from '@/types';
import { formatTime } from '@/types';

interface EvidenceTimelineProps {
  evidence: EvidenceChainItem[];
  onItemClick?: (item: EvidenceChainItem) => void;
}

const operationTypeLabels: Record<OperationType, string> = {
  bpm: 'BPM调整',
  beat: '拍点编辑',
  segment: '段落标注',
  inpoint: '入点设置',
  outpoint: '出点设置',
  delete: '删除操作',
  import: '导入音频',
};

const operationTypeColors: Record<OperationType, string> = {
  bpm: 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30',
  beat: 'bg-accent-green/20 text-accent-green border-accent-green/30',
  segment: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30',
  inpoint: 'bg-accent-green/20 text-accent-green border-accent-green/30',
  outpoint: 'bg-accent-magenta/20 text-accent-magenta border-accent-magenta/30',
  delete: 'bg-accent-red/20 text-accent-red border-accent-red/30',
  import: 'bg-bg-tertiary text-text-secondary border-bg-tertiary',
};

const EvidenceTimeline: React.FC<EvidenceTimelineProps> = ({ evidence, onItemClick }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatValue = (value: string, fieldName: string): string => {
    if (!value) return '（空）';
    if (fieldName === 'segment' && value.startsWith('{')) {
      try {
        const parsed = JSON.parse(value);
        return `${parsed.type}: ${formatTime(parsed.startTime)} - ${formatTime(parsed.endTime)}`;
      } catch {
        return value;
      }
    }
    if (['time', 'startTime', 'endTime', 'bestInPoint', 'bestOutPoint'].includes(fieldName)) {
      const num = parseFloat(value);
      if (!isNaN(num)) return formatTime(num);
    }
    return value;
  };

  if (evidence.length === 0) {
    return (
      <div className="text-center py-12 text-text-muted">
        <Clock size={48} className="mx-auto mb-4 opacity-50" />
        <p>暂无操作记录</p>
        <p className="text-sm mt-2">所有操作都会被记录在这里作为证据保留</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {evidence.map((item, index) => {
        const isExpanded = expandedIds.has(item.log.id);
        const isLast = index === evidence.length - 1;

        return (
          <div key={item.log.id} className="relative">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${
                  item.log.operationType === 'delete' ? 'bg-accent-red' :
                  item.log.operationType === 'bpm' ? 'bg-accent-cyan' :
                  item.log.operationType === 'beat' ? 'bg-accent-green' :
                  item.log.operationType === 'segment' ? 'bg-accent-yellow' :
                  'bg-bg-tertiary'
                }`} />
                {!isLast && (
                  <div className="w-0.5 h-full bg-bg-tertiary mt-1" />
                )}
              </div>

              <div className="flex-1 pb-6">
                <div
                  className={`p-4 rounded-lg border transition-all cursor-pointer hover:bg-bg-tertiary/50 ${
                    isExpanded ? 'bg-bg-tertiary/30 border-accent-cyan/30' : 'bg-bg-secondary/50 border-bg-tertiary'
                  }`}
                  onClick={() => {
                    toggleExpand(item.log.id);
                    onItemClick?.(item);
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`px-2 py-0.5 text-xs rounded border ${operationTypeColors[item.log.operationType]}`}>
                          {operationTypeLabels[item.log.operationType]}
                        </span>
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <User size={12} />
                          {item.log.operator}
                        </span>
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(item.log.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>

                      {item.log.reason && (
                        <p className="text-sm text-text-secondary mb-2">
                          <span className="text-accent-cyan">原因：</span>
                          {item.log.reason}
                        </p>
                      )}

                      {isExpanded && (
                        <div className="mt-4 space-y-3 animate-fadeIn">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-bg-primary/50 p-3 rounded-lg">
                              <span className="text-text-muted block mb-1">变更前</span>
                              <span className="font-mono text-accent-red">
                                {formatValue(item.log.oldValue, item.log.fieldName)}
                              </span>
                            </div>
                            <div className="bg-bg-primary/50 p-3 rounded-lg">
                              <span className="text-text-muted block mb-1">变更后</span>
                              <span className="font-mono text-accent-green">
                                {formatValue(item.log.newValue, item.log.fieldName)}
                              </span>
                            </div>
                          </div>

                          {item.relatedData && (
                            <div className="bg-bg-primary/50 p-3 rounded-lg">
                              <span className="text-text-muted block mb-2">关联数据详情</span>
                              <pre className="text-xs font-mono text-text-secondary overflow-auto max-h-32">
                                {JSON.stringify(item.relatedData, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button className="text-text-muted hover:text-text-primary transition-colors">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default EvidenceTimeline;
