import { Crosshair } from 'lucide-react';
import type { BoundaryEvent } from '@/types';
import { Tag, severityMeta } from './primitives';
import { fmt } from '@/lib/matrix';

export function BoundaryCard({ b }: { b: BoundaryEvent }) {
  const sev = severityMeta(b.severity);
  return (
    <div className="rounded-sm border border-alert/30 bg-alert/[0.06] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-alert" />
          <span className="text-sm font-semibold text-ink-100">{b.step}</span>
        </div>
        <Tag tone={sev.tone}>{sev.label}</Tag>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-300">{b.message}</p>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] sm:grid-cols-4">
        <div>
          <div className="text-muted">位置</div>
          <div className="mono text-ink-200">({b.position.row + 1}, {b.position.col + 1})</div>
        </div>
        <div>
          <div className="text-muted">数值</div>
          <div className="mono text-ink-200">{fmt(b.pivotValue, 6)}</div>
        </div>
        <div>
          <div className="text-muted">影响范围·行</div>
          <div className="mono text-ink-200">{b.impactRange.rows.map((r) => r + 1).join(',')}</div>
        </div>
        <div>
          <div className="text-muted">影响范围·列</div>
          <div className="mono text-ink-200">{b.impactRange.cols.map((c) => c + 1).join(',')}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px]">
        <span className="text-muted">来源行</span>
        <span className="mono rounded-sm border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-accent">
          {b.sourceFile}:{b.sourceLine}
        </span>
      </div>
    </div>
  );
}
