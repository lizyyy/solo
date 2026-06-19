import type { ErrorRecord } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { attributionTypeColors, attributionTypeLabels } from '@/data/seedData';
import { Clock, AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  record: ErrorRecord;
  delay?: number;
}

export default function RecordCard({ record, delay = 0 }: Props) {
  const { selectedRecordId, selectRecord } = useAppStore();
  const isSelected = selectedRecordId === record.id;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`record-card-enter p-3.5 rounded-md border cursor-pointer transition-all duration-200 ${
        record.isDuplicate
          ? 'bg-ochre-50/70 border-ochre-300 hover:border-ochre-400'
          : record.isWithdrawn
          ? 'bg-paper-100/60 border-paper-300 hover:border-paper-400'
          : 'bg-white/60 border-ink-100 hover:border-ink-300'
      } ${isSelected ? 'ring-2 ring-ink-600 ring-offset-1' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => selectRecord(isSelected ? null : record.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: attributionTypeColors[record.attributionType] }}
            />
            <span className="text-xs font-medium text-ink-700 truncate">
              {record.studentName}
            </span>
            <span className="text-xs text-ink-400 flex-shrink-0">
              · {formatTime(record.createdAt)}
            </span>
          </div>
          <h4 className="text-sm text-ink-800 font-medium line-clamp-1 mb-1.5">
            {record.questionTitle}
          </h4>
          <div className="flex flex-wrap gap-1">
            <span className="tag bg-ink-100 text-ink-600">
              {attributionTypeLabels[record.attributionType]}
            </span>
            {record.isWithdrawn && (
              <span className="tag bg-paper-200 text-paper-600 flex items-center gap-1">
                <RefreshCw size={10} />
                撤回补录
              </span>
            )}
            {record.isDuplicate && (
              <span className="tag bg-ochre-100 text-ochre-700 flex items-center gap-1 animate-pulse-soft">
                <AlertTriangle size={10} />
                重复样本
              </span>
            )}
          </div>
        </div>
        <Clock size={12} className="text-ink-300 flex-shrink-0 mt-1" />
      </div>

      {record.isDuplicate && record.duplicateReason && (
        <div className="mt-2 pt-2 border-t border-ochre-200/50">
          <p className="text-xs text-ochre-700 leading-relaxed">
            <span className="font-medium">异常原因：</span>
            {record.duplicateReason}
          </p>
        </div>
      )}
    </div>
  );
}
