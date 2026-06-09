import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';
import type { LayerStatus } from '@shared/types';
import type { TaskHistoryItem } from '@/lib/api';

const dotColors: Record<LayerStatus, string> = {
  approved: 'bg-status-approved ring-status-approved/30',
  needs_modify: 'bg-status-needs_modify ring-status-needs_modify/30',
  rejected: 'bg-status-rejected ring-status-rejected/30',
};

interface TimelineProps {
  items: TaskHistoryItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  if (items.length === 0) {
    return (
      <div className={cn('py-12 text-center text-sm text-slate-500', className)}>
        暂无历史记录
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-bg-border" />
      <ul className="space-y-5">
        {items.map((item, idx) => (
          <li
            key={item.id}
            className="relative pl-10 animate-fade-in-up"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <span
              className={cn(
                'absolute left-0 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full ring-4',
                dotColors[item.status],
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
            </span>

            <div className="rounded-xl border border-bg-border bg-bg-card/60 p-4 shadow-card backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
                <span className="inline-flex items-center rounded-md bg-brand-600/20 px-2 py-0.5 text-xs font-semibold text-brand-100 border border-brand-500/30">
                  v{item.version}
                </span>
                {item.layerName && (
                  <span className="font-mono text-xs text-slate-400">
                    {item.layerName}
                  </span>
                )}
                <StatusBadge status={item.status} size="sm" />
                <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-medium text-slate-300">{item.reviewer}</span>
                  <span>·</span>
                  <time>{new Date(item.reviewedAt).toLocaleString('zh-CN')}</time>
                </div>
              </div>

              <div className="space-y-2">
                {item.opinion && (
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {item.opinion}
                  </p>
                )}
                {item.note && (
                  <p className="text-xs text-slate-400 leading-relaxed italic border-l-2 border-bg-border pl-3 py-1">
                    {item.note}
                  </p>
                )}
                {item.changedFields && item.changedFields.length > 0 && (
                  <div className="pt-1.5 flex flex-wrap gap-1.5">
                    <span className="text-[11px] text-slate-500">变更字段：</span>
                    {item.changedFields.map((field) => (
                      <span
                        key={field}
                        className="text-[11px] rounded bg-bg-elevated px-1.5 py-0.5 text-slate-400 border border-bg-border font-mono"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
