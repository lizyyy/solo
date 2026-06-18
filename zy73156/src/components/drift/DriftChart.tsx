import type { Sample } from "@/data/types";
import { fmtNum } from "@/lib/format";

interface Props {
  sample: Sample;
  threshold: number;
}

export default function DriftChart({ sample, threshold }: Props) {
  const readings = sample.readings;
  const w = 760;
  const h = 240;
  const padL = 44;
  const padB = 28;
  const padT = 16;
  const padR = 16;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const maxDrift = Math.max(threshold * 1.8, ...readings.map((r) => r.drift));
  const xFor = (i: number) => padL + (i / (readings.length - 1)) * plotW;
  const yFor = (v: number) => padT + plotH - (v / maxDrift) * plotH;

  const linePath = readings
    .map((r, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(r.drift)}`)
    .join(" ");
  const areaPath =
    `M${xFor(0)},${yFor(0)} ` +
    readings.map((r, i) => `L${xFor(i)},${yFor(r.drift)}`).join(" ") +
    ` L${xFor(readings.length - 1)},${yFor(0)} Z`;

  const yTicks = [0, threshold / 2, threshold, maxDrift];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="driftArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* y grid */}
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={w - padR}
            y1={yFor(t)}
            y2={yFor(t)}
            stroke={t === threshold ? "#FB7185" : "#1e3a52"}
            strokeWidth={t === threshold ? 1.2 : 0.6}
            strokeDasharray={t === threshold ? "6 4" : "2 4"}
          />
          <text x={padL - 6} y={yFor(t) + 3} textAnchor="end" fontSize="9" fill="#64748b" fontFamily="monospace">
            {fmtNum(t, 1)}
          </text>
        </g>
      ))}

      {/* threshold label */}
      <text x={w - padR} y={yFor(threshold) - 5} textAnchor="end" fontSize="9" fill="#FB7185" fontFamily="monospace">
        拦截阈值 {fmtNum(threshold, 1)}
      </text>

      {/* area */}
      <path d={areaPath} fill="url(#driftArea)" />
      {/* line */}
      <path d={linePath} fill="none" stroke="#22D3EE" strokeWidth="1.8" />

      {/* points */}
      {readings.map((r, i) => {
        const blocked = r.status === "blocked";
        const warn = r.status === "warning";
        const c = blocked ? "#FB7185" : warn ? "#F59E0B" : "#34D399";
        return (
          <g key={r.id}>
            {blocked && (
              <rect
                x={xFor(i) - 14}
                y={padT}
                width={28}
                height={plotH}
                fill="#FB7185"
                opacity="0.12"
              />
            )}
            <circle cx={xFor(i)} cy={yFor(r.drift)} r={blocked ? 5 : 3.5} fill={c} stroke="#040D16" strokeWidth="1.5" />
            <text x={xFor(i)} y={yFor(r.drift) - 9} textAnchor="middle" fontSize="9" fill={c} fontFamily="monospace">
              {fmtNum(r.drift, 1)}
            </text>
            <text x={xFor(i)} y={h - 10} textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="monospace">
              {r.timeLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
