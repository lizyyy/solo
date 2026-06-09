import type { WeightRecord } from '@/types';
import { formatDate } from '@/utils/format';

interface Props {
  records: WeightRecord[];
  width?: number;
  height?: number;
}

export default function MiniWeightChart({ records, width = 320, height = 72 }: Props) {
  if (!records.length) return null;
  const data = [...records].sort(
    (a, b) => new Date(a.weighDate).getTime() - new Date(b.weighDate).getTime(),
  );
  const padL = 28;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const weights = data.map((d) => d.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const xStep = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = padL + i * xStep;
    const y = padT + h - ((d.weightKg - min) / range) * h;
    return { x, y, d };
  });
  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');
  const areaPath =
    `M ${points[0].x} ${padT + h} ` +
    points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
    ` L ${points[points.length - 1].x} ${padT + h} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="mw-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1E6FD9" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#1E6FD9" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2].map((i) => {
        const y = padT + (h / 2) * i;
        const val = max - (range / 2) * i;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + w} y2={y} stroke="#E2E8F0" strokeDasharray="2 3" />
            <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8">
              {val.toFixed(1)}kg
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#mw-grad)" />
      <path d={path} fill="none" stroke="#1E6FD9" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#1E6FD9" strokeWidth="2">
            <title>{`${formatDate(p.d.weighDate)} · ${p.d.weightKg}kg (BCS ${p.d.bcs})`}</title>
          </circle>
          {i === 0 || i === points.length - 1 ? (
            <text x={p.x} y={height - 2} textAnchor="middle" fontSize="9" fill="#64748B">
              {p.d.weighDate.slice(5)}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
