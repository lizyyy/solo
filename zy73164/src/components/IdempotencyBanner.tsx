import { Repeat } from 'lucide-react';

export function IdempotencyBanner({
  hit,
  runId,
  createdAt,
}: {
  hit: boolean;
  runId: string;
  createdAt?: number;
}) {
  if (!hit) return null;
  return (
    <div className="mfpr-flash flex items-start gap-3 rounded-sm border border-accent/30 bg-accent/[0.08] p-3">
      <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <div className="text-sm">
        <div className="font-semibold text-accent">命中已有回放 · 幂等去重</div>
        <div className="mt-0.5 text-xs leading-relaxed text-ink-300">
          相同请求已存在 run <span className="mono text-ink-100">{runId}</span>
          {createdAt ? ` · 产生于 ${new Date(createdAt).toLocaleString('zh-CN')}` : ''}。
          本次未新增记录，也未把同一条人工改判重复计数。
        </div>
      </div>
    </div>
  );
}
