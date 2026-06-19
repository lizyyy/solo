import type { TraceChip as TraceChipT } from '@/types';

export function TraceChips({ chips }: { chips: TraceChipT[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <div
          key={c.label}
          className="flex items-center gap-1.5 rounded-sm border border-white/10 bg-white/[0.02] px-2 py-1"
        >
          <span className="text-[10px] uppercase tracking-wider text-muted">{c.label}</span>
          <span className="mono text-[11px] text-ink-200">{c.value}</span>
        </div>
      ))}
    </div>
  );
}
