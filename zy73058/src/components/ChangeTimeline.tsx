import type { ChangeLogEntry } from '@/types';
import { User, Clock, AlertTriangle, ArrowRight, Info, Tag, Edit3 } from 'lucide-react';
import { clsx } from 'clsx';

const typeMeta = {
  rename: {
    label: '备件改名',
    cls: 'bg-sky-500',
    wrapper: 'border-sky-200 bg-sky-50/40',
    Icon: Tag,
  },
  threshold: {
    label: '阈值调整',
    cls: 'bg-orange-500',
    wrapper: 'border-orange-300 bg-orange-50/60',
    Icon: AlertTriangle,
  },
  supplement: {
    label: '字段补录',
    cls: 'bg-violet-500',
    wrapper: 'border-violet-200 bg-violet-50/40',
    Icon: Edit3,
  },
  none: { label: '无变更', cls: 'bg-zinc-400', wrapper: 'border-zinc-200 bg-zinc-50', Icon: Info },
};

export function ChangeTimeline({ logs }: { logs: ChangeLogEntry[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
        该记录无任何变更，处理结果与原始上报一致。
      </div>
    );
  }

  return (
    <ol className="relative border-l-2 border-zinc-200 ml-3 space-y-6">
      {logs.map((log, idx) => {
        const meta = typeMeta[log.changeType];
        const Icon = meta.Icon;
        return (
          <li key={log.id} className="ml-6">
            <span
              className={clsx(
                'absolute -left-[11px] w-5 h-5 rounded-full flex items-center justify-center text-white shadow',
                meta.cls
              )}
            >
              <Icon className="w-3 h-3" />
            </span>

            <div
              className={clsx(
                'rounded border p-4 transition-shadow hover:shadow-sm',
                meta.wrapper
              )}
            >
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-white',
                      meta.cls
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                  <span className="text-xs font-semibold text-zinc-700 font-mono bg-white px-2 py-0.5 rounded border border-zinc-200">
                    字段：{log.field}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">#{idx + 1}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {log.operator}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.changedAt}
                  </span>
                </div>
              </div>

              <div className="rounded bg-white/80 border border-zinc-200 p-3 mb-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">
                      变更前（原始值）
                    </div>
                    <div className="text-sm font-mono text-zinc-600 line-through decoration-red-400 decoration-2 bg-red-50 px-2.5 py-1.5 rounded border border-red-100">
                      {log.beforeValue || '（空字段）'}
                    </div>
                  </div>
                  <div className="flex items-center justify-center pt-4">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">
                      变更后（当前值）
                    </div>
                    <div className="text-sm font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded border-2 border-emerald-300">
                      {log.afterValue}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded border-l-4 border-amber-400 bg-amber-50 p-3 relative overflow-hidden">
                <div className="absolute top-2 right-2 text-[48px] opacity-5 text-amber-700 font-black leading-none pointer-events-none select-none">
                  IMPACT
                </div>
                <div className="flex items-start gap-2 relative">
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-amber-900 mb-1 uppercase tracking-wide">
                      ⚠️ 为什么影响结论 · 变更影响说明
                    </div>
                    <p className="text-sm text-amber-900/90 leading-relaxed whitespace-pre-wrap">
                      {log.impactExplanation}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
