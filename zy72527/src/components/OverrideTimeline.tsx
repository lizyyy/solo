import { ShieldAlert, ShieldCheck, History, User, Cog } from 'lucide-react';
import type { OverrideHistory } from '../types';
import { cn } from '../lib/utils';

interface OverrideTimelineProps {
  history: OverrideHistory[];
}

const operationLabels = {
  manual_override: '人工改判',
  batch_override: '批跑更新',
  system_override: '系统更新',
};

const operationColors = {
  manual_override: 'bg-orange-500 border-orange-500',
  batch_override: 'bg-blue-500 border-blue-500',
  system_override: 'bg-zinc-500 border-zinc-500',
};

export function OverrideTimeline({ history }: OverrideTimelineProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
        <History className="mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">暂无改判记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((item, index) => (
        <div key={item.id} className="relative pl-8">
          {index < history.length - 1 && (
            <div className="absolute left-[11px] top-8 h-full w-px bg-zinc-700" />
          )}
          <div
            className={cn(
              'absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-[#1a1d23]',
              item.wasOverridden ? 'border-rose-500' : operationColors[item.operationType]
            )}
          >
            {item.wasOverridden ? (
              <ShieldAlert className="h-3 w-3 text-rose-400" />
            ) : item.operationType === 'batch_override' ? (
              <Cog className="h-3 w-3 text-blue-400" />
            ) : item.isProtected ? (
              <ShieldCheck className="h-3 w-3 text-orange-400" />
            ) : (
              <User className="h-3 w-3 text-zinc-400" />
            )}
          </div>
          <div
            className={cn(
              'rounded-lg border p-4',
              item.wasOverridden
                ? 'border-rose-800/50 bg-rose-950/20'
                : 'border-zinc-700/50 bg-zinc-800/30'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium',
                    item.wasOverridden
                      ? 'bg-rose-500/20 text-rose-400'
                      : item.operationType === 'manual_override'
                      ? 'bg-orange-500/20 text-orange-400'
                      : item.operationType === 'batch_override'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-zinc-500/20 text-zinc-400'
                  )}
                >
                  {item.wasOverridden ? '改判被覆盖' : operationLabels[item.operationType]}
                </span>
                <span className="text-xs text-zinc-500">字段: {item.fieldLabel}</span>
              </div>
              <span className="text-xs text-zinc-500">
                {new Date(item.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-zinc-500">原值</p>
                <p className="mt-1 rounded bg-zinc-900/50 px-2 py-1.5 font-mono text-sm text-zinc-300">
                  {item.oldValue}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">新值</p>
                <p className="mt-1 rounded bg-zinc-900/50 px-2 py-1.5 font-mono text-sm text-white">
                  {item.newValue}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
              <span>操作人: {item.operator}</span>
              {item.isProtected && !item.wasOverridden && (
                <span className="flex items-center gap-1 text-emerald-500">
                  <ShieldCheck className="h-3 w-3" />
                  已保护
                </span>
              )}
              {item.wasOverridden && item.overriddenByBatch && (
                <span className="text-rose-400">被批跑覆盖: {item.overriddenByBatch}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
