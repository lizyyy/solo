import { useMemo, useState } from "react";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { BUOY_LOGS, MANUAL_RECORDS, METRICS } from "@/data/mockData";
import type { BuoyLog, MetricKey } from "@/types";
import { useTimeFormatter } from "@/hooks/useTimeFormatter";
import { StatusBadge } from "./StatusBadge";

const W = 1000;
const H = 380;
const PL = 56;
const PR = 24;
const PT = 24;
const PB = 48;
const INNER_W = W - PL - PR;
const INNER_H = H - PT - PB;

export function TimelineChart() {
  const {
    timeRange,
    cursor,
    selectedMetricKeys,
    showManualPoints,
    anomalies,
    selectedAnomalyId,
    selectAnomaly,
    toggleMetric,
  } = usePlaybackStore();
  const { fmtHM } = useTimeFormatter();
  const [hover, setHover] = useState<{ x: number; log: BuoyLog } | null>(null);

  const [t0, t1] = timeRange;

  const xOf = (t: number) => PL + ((t - t0) / (t1 - t0)) * INNER_W;
  const yOf = (v: number, domain: [number, number]) =>
    PT + INNER_H - ((v - domain[0]) / (domain[1] - domain[0])) * INNER_H;

  const yAxes = METRICS.filter((m) => selectedMetricKeys.includes(m.key));

  const buildPath = (key: MetricKey) => {
    const meta = METRICS.find((m) => m.key === key)!;
    return BUOY_LOGS.map((l, i) => {
      const x = xOf(l.timestamp);
      let v = l[key];
      if (key === "tideLevel" && l.tideUnit === "cm") v = v / 100;
      const y = yOf(v, meta.domain);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  };

  const buildArea = (key: MetricKey) => {
    const meta = METRICS.find((m) => m.key === key)!;
    const top = BUOY_LOGS.map((l, i) => {
      const x = xOf(l.timestamp);
      let v = l[key];
      if (key === "tideLevel" && l.tideUnit === "cm") v = v / 100;
      const y = yOf(v, meta.domain);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const last = BUOY_LOGS[BUOY_LOGS.length - 1];
    const first = BUOY_LOGS[0];
    return `${top} L${xOf(last.timestamp).toFixed(1)},${(PT + INNER_H).toFixed(1)} L${xOf(first.timestamp).toFixed(1)},${(PT + INNER_H).toFixed(1)} Z`;
  };

  const yTicks = useMemo(() => {
    const n = 4;
    const arr: { t: number; label: string }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n;
      arr.push({ t, label: fmtHM(t) });
    }
    return arr;
  }, [t0, t1, fmtHM]);

  const cursorX = xOf(cursor);

  return (
    <div className="glass-card relative">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="font-display text-base font-semibold text-white">
            多源时序曲线
          </h2>
          <p className="mt-0.5 text-xs text-ink-200">
            浮标传感器 · 人工船上记录 · 异常与待确认事件同屏叠加
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {METRICS.map((m) => {
            const active = selectedMetricKeys.includes(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                  active
                    ? "border-white/15 bg-white/10 text-white"
                    : "border-white/5 bg-white/0 text-ink-300 hover:text-white"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: active ? m.color : "#4B5A73" }}
                />
                {m.label}
                <span className="font-mono text-[10px] opacity-70">
                  {m.unit || "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative px-2 pb-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[380px] w-full"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            {METRICS.map((m) => (
              <linearGradient key={m.key} id={`grad-${m.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={m.color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={m.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* 网格 + X 刻度 */}
          {yTicks.map((tk, i) => (
            <g key={i}>
              <line
                x1={xOf(tk.t)}
                y1={PT}
                x2={xOf(tk.t)}
                y2={PT + INNER_H}
                stroke="rgba(197, 208, 224, 0.08)"
              />
              <text
                x={xOf(tk.t)}
                y={H - 16}
                fill="#96A4BE"
                fontSize="11"
                textAnchor="middle"
                fontFamily="JetBrains Mono"
              >
                {tk.label}
              </text>
            </g>
          ))}

          {/* Y 轴（按指标分别显示在左侧） */}
          {yAxes.map((m, idx) => {
            const x = PL - 12 - idx * 42;
            const [lo, hi] = m.domain;
            const ticks = [lo, (lo + hi) / 2, hi];
            return (
              <g key={m.key}>
                {ticks.map((v, i) => (
                  <text
                    key={i}
                    x={x}
                    y={yOf(v, m.domain) + 3.5}
                    fill={m.color}
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                    textAnchor="end"
                  >
                    {typeof v === "number" ? v.toFixed(1) : v}
                  </text>
                ))}
                <text
                  x={x}
                  y={PT - 6}
                  fill={m.color}
                  fontSize="10"
                  textAnchor="end"
                >
                  {m.label}
                </text>
              </g>
            );
          })}

          {/* 区域 + 折线 */}
          {selectedMetricKeys.map((k) => (
            <g key={`g-${k}`}>
              <path d={buildArea(k)} fill={`url(#grad-${k})`} />
              <path
                d={buildPath(k)}
                fill="none"
                stroke={METRICS.find((m) => m.key === k)!.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* 数据点悬浮热区 */}
          {BUOY_LOGS.map((l) => (
            <rect
              key={`hot-${l.id}`}
              x={xOf(l.timestamp) - 8}
              y={PT}
              width={16}
              height={INNER_H}
              fill="transparent"
              onMouseEnter={() => setHover({ x: xOf(l.timestamp), log: l })}
              onClick={() => {
                const hit = anomalies.find((a) => Math.abs(a.timestamp - l.timestamp) < 20 * 60000);
                if (hit) selectAnomaly(hit.id);
              }}
              style={{ cursor: "pointer" }}
            />
          ))}

          {/* 人工记录点 */}
          {showManualPoints &&
            MANUAL_RECORDS.map((r) => {
              const meta = METRICS.find((m) => m.key === "dissolvedOxygen")!;
              const y = r.sampleDO ? yOf(r.sampleDO, meta.domain) : PT + INNER_H / 2;
              const late = r.arrivedAt > r.recordedAt + 30 * 60000;
              return (
                <g key={r.id} transform={`translate(${xOf(r.recordedAt)},${y})`}>
                  {late && (
                    <circle r="14" fill="rgba(167,139,250,0.25)" className="animate-pulseRing" />
                  )}
                  <polygon
                    points="0,-7 7,0 0,7 -7,0"
                    fill="#A78BFA"
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                  <text
                    y="-14"
                    textAnchor="middle"
                    fill="#C4B5FD"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                  >
                    船采
                  </text>
                </g>
              );
            })}

          {/* 异常点 */}
          {anomalies.map((a) => {
            const color = a.type === "anomaly" ? "#E63946" : "#F4A261";
            const y = PT + INNER_H / 2;
            const sel = selectedAnomalyId === a.id;
            return (
              <g
                key={a.id}
                transform={`translate(${xOf(a.timestamp)},${y})`}
                style={{ cursor: "pointer" }}
                onClick={() => selectAnomaly(a.id)}
              >
                <circle
                  r={sel ? 10 : 7}
                  fill={color}
                  fillOpacity={sel ? 0.9 : 0.85}
                  stroke="#fff"
                  strokeWidth="1.5"
                />
                {sel && <circle r="16" fill={color} fillOpacity="0.25" className="animate-pulseRing" />}
                <text
                  y="-20"
                  textAnchor="middle"
                  fill={color}
                  fontSize="11"
                  fontWeight="600"
                >
                  {a.type === "anomaly" ? "异常" : a.confirmed ? "已确认" : "待确认"}
                </text>
              </g>
            );
          })}

          {/* 当前游标 */}
          <line
            x1={cursorX}
            y1={PT}
            x2={cursorX}
            y2={PT + INNER_H}
            stroke="#53D5C9"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <rect
            x={cursorX - 34}
            y={PT + INNER_H + 6}
            width="68"
            height="22"
            rx="6"
            fill="#2EC4B6"
          />
          <text
            x={cursorX}
            y={PT + INNER_H + 21}
            textAnchor="middle"
            fill="#04172E"
            fontSize="11"
            fontFamily="JetBrains Mono"
            fontWeight="700"
          >
            {fmtHM(cursor)}
          </text>

          {/* 悬浮 Tooltip */}
          {hover && (
            <g transform={`translate(${Math.min(hover.x + 12, W - 230)}, ${PT + 8}`}>
              <rect
                width="218"
                height="120"
                rx="10"
                fill="rgba(4,23,46,0.92)"
                stroke="rgba(255,255,255,0.1)"
              />
              <g fontFamily="JetBrains Mono" fontSize="11">
                <text x="12" y="20" fill="#88E3DA">
                  {fmtHM(hover.log.timestamp)}
                </text>
                <text x="12" y="40" fill="#E7ECF5">
                  溶解氧
                </text>
                <text x="130" y="40" fill="#2EC4B6">
                  {hover.log.dissolvedOxygen.toFixed(2)} mg/L
                </text>
                <text x="12" y="58" fill="#E7ECF5">
                  浊度
                </text>
                <text x="130" y="58" fill="#F4A261">
                  {hover.log.turbidity.toFixed(1)} NTU
                </text>
                <text x="12" y="76" fill="#E7ECF5">
                  pH
                </text>
                <text x="130" y="76" fill="#8B9AFF">
                  {hover.log.ph.toFixed(2)}
                </text>
                <text x="12" y="94" fill="#E7ECF5">
                  潮位
                </text>
                <text x="130" y="94" fill="#60A5FA">
                  {hover.log.tideLevel.toFixed(2)} {hover.log.tideUnit}
                </text>
                <text x="12" y="112" fill="#96A4BE" fontSize="10">
                  {hover.log.status === "normal"
                    ? "设备状态：正常"
                    : hover.log.status === "warning"
                      ? "设备状态：告警"
                      : "设备状态：异常"}
                </text>
              </g>
            </g>
          )}
        </svg>

        <div className="absolute left-6 top-4 flex gap-2">
          {hover && (
            <StatusBadge
              kind={hover.log.status === "error" ? "anomaly" : hover.log.status === "warning" ? "pending" : "ok"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
