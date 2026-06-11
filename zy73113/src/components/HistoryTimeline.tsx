import { useState } from 'react';
import type { HistoryVersion, OperationType } from '../../shared/types';
import { OperationIcon, OPERATION_LABELS } from './StatusBadge';
import { CompareModal } from './Modal';
import { formatDate } from '../utils/date';
import { JUDGMENT_LABELS, STATUS_LABELS } from '../../shared/types';
import { GitCompare } from 'lucide-react';

interface HistoryTimelineProps {
  history: HistoryVersion[];
}

const operationColors: Record<OperationType, string> = {
  create: 'bg-slate-500',
  remark_update: 'bg-blue-500',
  judgment_change: 'bg-purple-500',
  material_add: 'bg-emerald-500',
  status_change: 'bg-amber-500',
};

function formatValue(type: OperationType, value: string | null): string {
  if (!value) return '（空）';
  
  if (type === 'judgment_change') {
    return JUDGMENT_LABELS[value as keyof typeof JUDGMENT_LABELS] || value;
  }
  
  if (type === 'status_change') {
    return STATUS_LABELS[value as keyof typeof STATUS_LABELS] || value;
  }
  
  if (value.length > 50) {
    return value.slice(0, 50) + '...';
  }
  
  return value;
}

export function HistoryTimeline({ history }: HistoryTimelineProps) {
  const [compareModal, setCompareModal] = useState<{
    isOpen: boolean;
    oldValue: string | null;
    newValue: string | null;
    oldLabel: string;
    newLabel: string;
  }>({ isOpen: false, oldValue: null, newValue: null, oldLabel: '', newLabel: '' });

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        暂无历史记录
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
        
        <div className="space-y-4">
          {history.map((item, index) => (
            <div
              key={item.id}
              className="relative pl-10 animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div
                className={`absolute left-2.5 w-3 h-3 rounded-full ${operationColors[item.operationType]} animate-timeline-pop ring-4 ring-white`}
                style={{ animationDelay: `${index * 50 + 100}ms` }}
              />
              
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 hover:border-primary-300 transition-colors group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded text-white ${operationColors[item.operationType]}`}>
                      <OperationIcon type={item.operationType} className="w-3 h-3" />
                      {OPERATION_LABELS[item.operationType]}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {item.version}
                    </span>
                  </div>
                  <button
                    onClick={() => setCompareModal({
                      isOpen: true,
                      oldValue: item.oldValue,
                      newValue: item.newValue,
                      oldLabel: `变更前 (${item.version})`,
                      newLabel: `变更后 (${item.version})`,
                    })}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-primary-600 transition-all"
                    title="查看版本对比"
                  >
                    <GitCompare className="w-4 h-4" />
                  </button>
                </div>
                
                {item.operationType !== 'create' && (
                  <div className="grid grid-cols-2 gap-3 mb-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">变更前</div>
                      <div className="text-slate-600 font-mono text-xs bg-red-50 px-2 py-1 rounded line-through">
                        {formatValue(item.operationType, item.oldValue)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">变更后</div>
                      <div className="text-slate-700 font-mono text-xs bg-emerald-50 px-2 py-1 rounded">
                        {formatValue(item.operationType, item.newValue)}
                      </div>
                    </div>
                  </div>
                )}
                
                {item.changeReason && (
                  <div className="mb-2 text-sm">
                    <span className="text-slate-500">变更原因：</span>
                    <span className="text-slate-700">{item.changeReason}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>操作人：{item.operator}</span>
                  <span>{formatDate(item.timestamp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <CompareModal
        isOpen={compareModal.isOpen}
        onClose={() => setCompareModal({ ...compareModal, isOpen: false })}
        oldValue={compareModal.oldValue}
        newValue={compareModal.newValue}
        oldLabel={compareModal.oldLabel}
        newLabel={compareModal.newLabel}
      />
    </>
  );
}
