import type { FittingRecord, ParamDifference, ADSRParams } from '@/types';

interface CompareTableProps {
  records: FittingRecord[];
  differences: ParamDifference[];
}

const PARAM_LABELS: Record<keyof ADSRParams, string> = {
  attack: 'Attack (ms)',
  decay: 'Decay (ms)',
  sustain: 'Sustain (%)',
  release: 'Release (ms)',
};

function formatValue(param: keyof ADSRParams, value: number): string {
  if (param === 'sustain') return `${(value * 100).toFixed(1)}%`;
  return `${value.toFixed(2)}`;
}

function getDiffColor(pct: number): string {
  if (pct <= 10) return 'text-synth-green';
  if (pct <= 20) return 'text-synth-amber';
  return 'text-red-400';
}

function getDiffBg(pct: number): string {
  if (pct <= 10) return 'bg-synth-green/5';
  if (pct <= 20) return 'bg-synth-amber/5';
  return 'bg-red-500/5';
}

export default function CompareTable({ records, differences }: CompareTableProps) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-synth-border bg-synth-card p-8 text-center">
        <span className="text-sm text-synth-muted font-mono">请选择记录进行对比</span>
      </div>
    );
  }

  const params: (keyof ADSRParams)[] = ['attack', 'decay', 'sustain', 'release'];

  return (
    <div className="rounded-xl border border-synth-border bg-synth-card overflow-hidden">
      <div className="px-4 py-3 border-b border-synth-border">
        <h3 className="text-sm font-mono font-semibold text-synth-green tracking-wide">
          参数对比
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-synth-border">
              <th className="text-left px-4 py-2 text-synth-muted font-medium">参数</th>
              {records.map((r) => (
                <th key={r.id} className="text-right px-4 py-2 text-synth-muted font-medium">
                  {r.instrumentLabel || '—'}
                  <br />
                  <span className="text-[10px] opacity-60">
                    {new Date(r.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </th>
              ))}
              <th className="text-right px-4 py-2 text-synth-muted font-medium">最大差异</th>
            </tr>
          </thead>
          <tbody>
            {params.map((param) => {
              const diff = differences.find((d) => d.param === param);
              const maxPct = diff?.maxDiffPercent ?? 0;
              return (
                <tr key={param} className={`border-b border-synth-border/50 ${getDiffBg(maxPct)}`}>
                  <td className="px-4 py-2.5 text-gray-300 font-medium">{PARAM_LABELS[param]}</td>
                  {records.map((r) => {
                    const val = r.conclusion[param];
                    return (
                      <td key={r.id} className="text-right px-4 py-2.5 text-gray-300">
                        {formatValue(param, val)}
                      </td>
                    );
                  })}
                  <td className={`text-right px-4 py-2.5 font-semibold ${getDiffColor(maxPct)}`}>
                    {maxPct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {differences.length > 0 && (
        <div className="px-4 py-3 border-t border-synth-border bg-synth-bg/50">
          <div className="flex flex-wrap gap-3 text-[10px]">
            {params.map((param) => {
              const diff = differences.find((d) => d.param === param);
              if (!diff) return null;
              return (
                <span key={param} className="flex items-center gap-1">
                  <span className="text-synth-muted">{PARAM_LABELS[param]}:</span>
                  <span className={getDiffColor(diff.maxDiffPercent)}>
                    {diff.maxDiff.toFixed(3)}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
