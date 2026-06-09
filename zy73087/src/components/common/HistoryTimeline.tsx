import type { HistoryRecord, HistoryAction } from '../../../shared/types';
import { ActionBadge, StatusBadge, formatDate } from './Badges';
import { STATUS_LABELS } from '../../../shared/types';
import { clsx } from 'clsx';

const ACTION_DOT: Record<HistoryAction, string> = {
  create: 'bg-teal-500 ring-teal-200',
  update: 'bg-slate-400 ring-slate-200',
  rejudge: 'bg-blue-500 ring-blue-200',
  cad_note: 'bg-amber-500 ring-amber-200',
  change_order: 'bg-purple-500 ring-purple-200',
  csv_import: 'bg-emerald-500 ring-emerald-200',
  csv_update: 'bg-cyan-500 ring-cyan-200',
};

interface Props {
  history: HistoryRecord[];
  compact?: boolean;
}

export function HistoryTimeline({ history, compact = false }: Props) {
  if (history.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500 text-sm">
        暂无操作记录
      </div>
    );
  }
  return (
    <ol className={clsx('relative', !compact && 'border-l-2 border-slate-200 ml-3 pl-6')}>
      {history.map((h) => (
        <li key={h.id} className={clsx('mb-6 last:mb-0', compact ? 'mb-4' : '')}>
          {!compact && (
            <span
              className={clsx(
                'absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ring-4',
                ACTION_DOT[h.action],
              )}
            />
          )}
          <div className={clsx(
            'rounded-lg border border-slate-200 bg-white p-4 shadow-sm',
            compact ? 'p-3' : '',
          )}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <ActionBadge action={h.action} />
                <span className="text-sm text-slate-500">操作人：{h.operator}</span>
              </div>
              <time className="text-xs text-slate-400">{formatDate(h.createdAt)}</time>
            </div>
            {(h.oldStatus || h.newStatus) && (
              <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
                <span className="text-slate-600">状态：</span>
                {h.oldStatus && <StatusBadge status={h.oldStatus} />}
                {h.newStatus && h.oldStatus !== h.newStatus && (
                  <>
                    <span className="text-slate-400">→</span>
                    <StatusBadge status={h.newStatus} />
                  </>
                )}
                {!h.oldStatus && h.newStatus && (
                  <span className="text-slate-500 text-xs">初始状态 {STATUS_LABELS[h.newStatus]}</span>
                )}
              </div>
            )}
            {h.remark && (
              <p className="text-sm text-slate-700 mb-2 whitespace-pre-wrap">{h.remark}</p>
            )}
            {Object.keys(h.fieldChanges || {}).length > 0 && (
              <div className="mt-2 rounded-md bg-slate-50 border border-slate-200 p-3">
                <div className="text-xs text-slate-500 mb-1">字段变更：</div>
                <ul className="space-y-1 text-xs">
                  {Object.entries(h.fieldChanges).map(([field, v]) => (
                    <li key={field} className="flex items-start gap-2">
                      <span className="font-medium text-slate-700 shrink-0 w-24 truncate">{field}</span>
                      <span className="text-slate-500 shrink-0">→</span>
                      <span className="text-slate-600 break-all">
                        <span className="line-through text-slate-400 mr-2">
                          {v.old === '' || v.old === undefined || v.old === null ? '（空）' : String(v.old)}
                        </span>
                        {String(v.new === '' || v.new === undefined || v.new === null ? '（空）' : v.new)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
