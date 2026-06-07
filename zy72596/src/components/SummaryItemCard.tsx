import { SummaryItem, SOURCE_LABELS, SOURCE_BADGE_COLORS } from '@/types';
import { Check, AlertTriangle, BookOpen, FileText, PenLine } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDate } from '@/utils/common';

interface SummaryItemCardProps {
  item: SummaryItem;
  onToggleConfirm?: () => void;
  showActions?: boolean;
}

const sourceIcons = {
  training_log: FileText,
  threshold_note: BookOpen,
  manual: PenLine,
};

export function SummaryItemCard({ item, onToggleConfirm, showActions = false }: SummaryItemCardProps) {
  const Icon = sourceIcons[item.source];

  return (
    <div
      className={clsx(
        'p-4 border rounded-sm transition-all',
        item.needsConfirmation && !item.isConfirmed
          ? 'border-orange-300 bg-orange-50/50'
          : 'border-primary-100 bg-white'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            'w-8 h-8 rounded flex items-center justify-center flex-shrink-0',
            item.isConfirmed ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-600'
          )}
        >
          {item.isConfirmed ? <Check size={16} /> : <Icon size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary-800 leading-relaxed">{item.content}</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={clsx('badge', SOURCE_BADGE_COLORS[item.source])}>
              {SOURCE_LABELS[item.source]}
            </span>
            {item.needsConfirmation && (
              <span className="badge bg-orange-100 text-orange-700 border-orange-200 flex items-center gap-1">
                <AlertTriangle size={12} />
                {item.isConfirmed ? '已确认' : '待确认'}
              </span>
            )}
            {item.isConfirmed && item.confirmedBy && (
              <span className="text-xs text-primary-400">
                由 {item.confirmedBy} 于 {formatDate(item.confirmedAt!)} 确认
              </span>
            )}
          </div>
        </div>
        {showActions && item.needsConfirmation && !item.isConfirmed && onToggleConfirm && (
          <button
            onClick={onToggleConfirm}
            className="btn btn-secondary text-xs px-3 py-1 flex-shrink-0"
          >
            确认
          </button>
        )}
      </div>
    </div>
  );
}
