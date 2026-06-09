import type { HistoryEntry, MaterialStatus } from '../types';
import { STATUS_LABEL } from '../types';
import { User, Clock, Info } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  history: HistoryEntry[];
}

const STATUS_ORDER: Record<MaterialStatus, number> = {
  CONFIRMED: 0,
  PENDING: 1,
  REJECTED: 2,
};

function statusColor(v: string) {
  const k = Object.entries(STATUS_LABEL).find(([, l]) => l === v)?.[0] as
    | MaterialStatus
    | undefined;
  if (k === 'CONFIRMED') return 'bg-confirm-500';
  if (k === 'PENDING') return 'bg-pending-500';
  if (k === 'REJECTED') return 'bg-reject-500';
  if (v === '已复核') return 'bg-navy-500';
  return 'bg-abnormal-500';
}

export function HistoryTimeline({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-ink-500 bg-ink-50/50">
        暂无变更记录
      </div>
    );
  }

  // 排序：status 变更优先使用状态色，其他使用通用色
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-song font-bold text-navy-700 text-sm flex items-center gap-2">
          <Clock size={16} />
          历史变更时间线
          <span className="chip">{history.length}</span>
        </h4>
        <div className="text-[11px] text-ink-500 flex items-center gap-1">
          <Info size={12} />
          显示从旧值到新值的完整变更（非仅最终值）
        </div>
      </div>

      <ol className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-ink-200">
        {history.map((h, i) => {
          const isStatus = h.field === 'status';
          const pointClass = isStatus ? statusColor(h.newValue) : 'bg-navy-400';
          return (
            <li
              key={h.id}
              className="relative pb-4 last:pb-0 anim-grow-y"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* 节点圆点 */}
              <span
                className={cn(
                  'absolute left-[-19px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow',
                  pointClass,
                )}
              />

              <div className="card p-3 ml-2">
                <div className="flex items-center gap-3 text-[11px] text-ink-500 mb-1.5 flex-wrap">
                  <span className="font-mono tabular-nums">
                    {new Date(h.timestamp).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <User size={11} />
                    {h.operator}
                  </span>
                  <span className="chip">字段：{h.fieldLabel}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 bg-ink-100 text-ink-500 line-through decoration-fire-500 decoration-2 font-mono text-xs">
                    {h.oldValue}
                  </span>
                  <span className="text-navy-400 font-bold">→</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 font-mono text-xs font-bold text-white',
                      isStatus ? statusColor(h.newValue) : 'bg-navy-500',
                    )}
                  >
                    {h.newValue}
                  </span>
                </div>

                <div className="mt-2 pt-2 border-t border-dashed border-ink-200">
                  <div className="text-[10px] uppercase tracking-wider text-ink-400 font-bold mb-0.5">
                    变更原因（用于交接班追溯）
                  </div>
                  <p className="text-xs text-ink-800 leading-relaxed bg-white border-l-2 border-navy-300 pl-2 py-1">
                    {h.reason || <span className="text-fire-600">未填写</span>}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {history.length > 5 && (
        <p className="text-[11px] text-center text-ink-500">
          最早的 {history.length - 5} 条记录已折叠展示（上方按时间倒序）
        </p>
      )}
    </div>
  );
}
