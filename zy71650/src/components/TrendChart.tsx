import type { FittingRecord } from '@/types';

interface TrendChartProps {
  records: FittingRecord[];
}

const LINE_COLORS: Record<string, string> = {
  attack: '#39FF14',
  decay: '#FFB800',
  sustain: '#3B82F6',
  release: '#EF4444',
};

const LINE_LABELS: Record<string, string> = {
  attack: 'Attack',
  decay: 'Decay',
  sustain: 'Sustain',
  release: 'Release',
};

export default function TrendChart({ records }: TrendChartProps) {
  if (records.length < 2) {
    return (
      <div className="rounded-xl border border-synth-border bg-synth-card p-8 text-center">
        <span className="text-sm text-synth-muted font-mono">需要至少 2 条记录才能显示趋势</span>
      </div>
    );
  }

  const sorted = [...records].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const params = ['attack', 'decay', 'sustain', 'release'] as const;

  const width = 700;
  const height = 280;
  const padL = 50;
  const padR = 20;
  const padT = 30;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxValues: Record<string, number> = {};
  for (const p of params) {
    maxValues[p] = Math.max(...sorted.map((r) => r.conclusion[p]), 0.001);
  }

  const xScale = (i: number) => padL + (i / (sorted.length - 1)) * plotW;
  const yScale = (val: number, maxVal: number) => padT + plotH - (val / maxVal) * plotH;

  const makePath = (param: keyof typeof sorted[0]['conclusion']) => {
    return sorted
      .map((r, i) => {
        const x = xScale(i);
        const y = yScale(r.conclusion[param], maxValues[param]);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="rounded-xl border border-synth-border bg-synth-card overflow-hidden">
      <div className="px-4 py-3 border-b border-synth-border flex items-center justify-between">
        <h3 className="text-sm font-mono font-semibold text-synth-green tracking-wide">
          参数趋势
        </h3>
        <div className="flex gap-3">
          {params.map((p) => (
            <span key={p} className="flex items-center gap-1 text-[10px]">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: LINE_COLORS[p] }}
              />
              <span className="text-synth-muted">{LINE_LABELS[p]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          style={{ maxHeight: '300px' }}
        >
          <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#2A2D3E" strokeWidth="1" />
          <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#2A2D3E" strokeWidth="1" />

          {[0.25, 0.5, 0.75].map((pct) => (
            <line
              key={pct}
              x1={padL}
              y1={padT + plotH * (1 - pct)}
              x2={padL + plotW}
              y2={padT + plotH * (1 - pct)}
              stroke="#2A2D3E"
              strokeWidth="0.5"
              strokeDasharray="4,4"
            />
          ))}

          {[0.25, 0.5, 0.75].map((pct) => (
            <text
              key={pct}
              x={padL - 6}
              y={padT + plotH * (1 - pct) + 3}
              textAnchor="end"
              fill="#6B7280"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              {(pct * 100).toFixed(0)}%
            </text>
          ))}

          {sorted.map((r, i) => {
            const x = xScale(i);
            const dateStr = new Date(r.createdAt).toLocaleDateString('zh-CN', {
              month: 'short',
              day: 'numeric',
            });
            return (
              <g key={r.id}>
                <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="#2A2D3E" strokeWidth="0.5" strokeDasharray="2,4" />
                <text
                  x={x}
                  y={padT + plotH + 16}
                  textAnchor="middle"
                  fill="#6B7280"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {dateStr}
                </text>
              </g>
            );
          })}

          {params.map((param) => (
            <g key={param}>
              <path
                d={makePath(param)}
                fill="none"
                stroke={LINE_COLORS[param]}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity="0.8"
              />
              {sorted.map((r, i) => {
                const x = xScale(i);
                const y = yScale(r.conclusion[param], maxValues[param]);
                const hasAnomaly = r.anomalies.length > 0;
                return (
                  <g key={`${r.id}-${param}`}>
                    {hasAnomaly && (
                      <circle cx={x} cy={y} r="5" fill="none" stroke="#EF4444" strokeWidth="1.5" opacity="0.6" />
                    )}
                    <circle cx={x} cy={y} r="3" fill={LINE_COLORS[param]} />
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
