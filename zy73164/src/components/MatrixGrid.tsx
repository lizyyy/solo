import { cn } from '@/lib/utils';
import { fmt } from '@/lib/matrix';

export function MatrixGrid({
  m,
  className,
  highlight,
  cellClassName,
}: {
  m?: number[][] | null;
  className?: string;
  highlight?: { rows: number[]; cols: number[] };
  cellClassName?: string;
}) {
  if (!m || m.length === 0 || m.every((r) => !r || r.length === 0)) {
    return <div className="mono text-sm text-alert">∅ 空集合（无历史答案可比对）</div>;
  }
  const cols = m[0].length;
  return (
    <div
      className={cn('inline-grid gap-px overflow-hidden rounded-sm border border-white/[0.06]', className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(56px, 1fr))` }}
    >
      {m.flatMap((row, i) =>
        row.map((v, j) => {
          const hl = highlight && (highlight.rows.includes(i) || highlight.cols.includes(j));
          return (
            <div
              key={`${i}-${j}`}
              className={cn(
                'mono px-2 py-1 text-xs tabular-nums',
                hl ? 'bg-alert/20 text-alert' : 'bg-white/[0.02] text-ink-200',
                cellClassName,
              )}
            >
              {fmt(v)}
            </div>
          );
        }),
      )}
    </div>
  );
}

export function MatrixCells({
  m,
  onChange,
}: {
  m: number[][];
  onChange: (m: number[][]) => void;
}) {
  const set = (i: number, j: number, val: string) => {
    const next = m.map((r) => r.slice());
    const num = val === '' || val === '-' ? 0 : Number(val);
    next[i][j] = Number.isFinite(num) ? num : 0;
    onChange(next);
  };
  const addRow = () => {
    const cols = m[0]?.length ?? 3;
    onChange([...m, Array.from({ length: cols }, () => 0)]);
  };
  const addCol = () => onChange(m.map((r) => [...r, 0]));
  const delRow = () => onChange(m.slice(0, -1));
  const delCol = () => onChange(m.map((r) => r.slice(0, -1)));

  return (
    <div className="space-y-2">
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${m[0]?.length ?? 0}, 1fr)` }}>
        {m.flatMap((row, i) =>
          row.map((v, j) => (
            <input
              key={`${i}-${j}`}
              type="number"
              step="any"
              value={Number.isFinite(v) ? v : 0}
              onChange={(e) => set(i, j, e.target.value)}
              className="mono h-9 w-16 rounded-sm border border-white/10 bg-ink-900/80 px-2 text-xs text-ink-100 outline-none focus:border-accent/60 focus:bg-ink-900"
            />
          )),
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-muted">
        <button type="button" onClick={addRow} className="rounded-sm border border-white/10 px-2 py-1 hover:bg-white/5">
          + 行
        </button>
        <button type="button" onClick={addCol} className="rounded-sm border border-white/10 px-2 py-1 hover:bg-white/5">
          + 列
        </button>
        <button type="button" onClick={delRow} className="rounded-sm border border-white/10 px-2 py-1 hover:bg-white/5">
          − 行
        </button>
        <button type="button" onClick={delCol} className="rounded-sm border border-white/10 px-2 py-1 hover:bg-white/5">
          − 列
        </button>
      </div>
    </div>
  );
}
