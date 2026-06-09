import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Scatter,
  ZAxis,
} from "recharts";
import { useAppStore } from "@/store/useAppStore";
import type { SummaryFilter } from "@/store/useAppStore";
import { selectRecordsByBin } from "@/utils/anomalyAlgo";

interface ChartPoint {
  window: string;
  timeLabel: string;
  robustMean: number;
  rawMean: number;
  count: number;
  anomalousCount: number;
  boundaryCount: number;
  hasStrongPull: boolean;
  highlight: boolean;
  filterMatched: boolean;
}

function formatWindowLabel(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours();
  return `${m}/${day} ${String(h).padStart(2, "0")}:00`;
}

function binMatchesFilter(
  bin: { anomalousCount: number; boundaryCount: number; hasStrongPull: boolean },
  filter: SummaryFilter,
): boolean {
  switch (filter) {
    case "anomalous":
      return bin.anomalousCount > 0;
    case "boundary":
      return bin.boundaryCount > 0;
    case "strong":
      return bin.hasStrongPull;
    default:
      return bin.anomalousCount + bin.boundaryCount > 0;
  }
}

const CUSTOM_TICK = (props: any) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="#7fa0ad" fontSize={10} fontFamily="JetBrains Mono, monospace">
        {payload.value}
      </text>
    </g>
  );
};

export function TrendChart() {
  const result = useAppStore((s) => s.lastAlgoResult);
  const thresholdMm = useAppStore((s) => s.thresholdMm);
  const selectedWindow = useAppStore((s) => s.selectedWindow);
  const selectWindow = useAppStore((s) => s.selectWindow);
  const selectRecord = useAppStore((s) => s.selectRecord);
  const filterKind = useAppStore((s) => s.filterKind);
  const pulseKey = useAppStore((s) => s.pulseKey);

  const data: ChartPoint[] = useMemo(() => {
    if (!result) return [];
    return result.bins.map((b) => ({
      window: b.window,
      timeLabel: formatWindowLabel(b.window),
      robustMean: +b.robustMean.toFixed(3),
      rawMean: +b.mean.toFixed(3),
      count: b.count,
      anomalousCount: b.anomalousCount,
      boundaryCount: b.boundaryCount,
      hasStrongPull: b.hasStrongPull,
      highlight: b.anomalousCount + b.boundaryCount > 0,
      filterMatched: binMatchesFilter(b, filterKind),
    }));
  }, [result, filterKind]);

  const maxY = useMemo(() => {
    if (!data.length) return 5;
    const m = Math.max(...data.map((d) => Math.max(d.rawMean, d.robustMean) + d.anomalousCount * 0.2));
    return Math.ceil(m * 1.2);
  }, [data]);

  const handleClick = (d: any) => {
    const window: string | undefined = d?.activePayload?.[0]?.payload?.window;
    if (!window) return;
    if (selectedWindow === window) {
      selectWindow(null);
    } else {
      selectWindow(window);
      selectRecord(null);
    }
  };

  const scatterData = useMemo(() => {
    if (!result) return [] as any[];
    return result.records
      .map((r) => {
        const bin = result.bins.find((b) => b.window === r.timeWindow);
        if (!bin) return null;
        const matched =
          filterKind === "all"
            ? r.status !== "normal"
            : filterKind === "anomalous"
              ? r.status === "anomalous"
              : filterKind === "boundary"
                ? r.status === "boundary"
                : r.isStrongPull;
        if (!matched) return null;
        return {
          window: formatWindowLabel(r.timeWindow),
          y: +(bin.robustMean + (r.deviation ?? 0)).toFixed(3),
          size: 80 + (r.contribution ?? 0) * 320,
          status: r.status,
          isStrong: r.isStrongPull,
          rawWindow: r.timeWindow,
          value: r.rawValue,
          deviation: r.deviation,
        };
      })
      .filter(Boolean);
  }, [result, filterKind]);

  return (
    <div
      key={pulseKey}
      className="animate-stagger-in relative h-[460px] rounded border border-ink-700/60 bg-ink-900/60 backdrop-blur-sm grain overflow-hidden"
    >
      <div className="absolute top-3 left-4 flex items-baseline gap-3 z-10">
        <div className="font-serif text-lg text-white">变形趋势 · 时间窗口</div>
        <div className="text-[11px] text-ink-600 font-mono">
          单位 mm · 4 小时窗口
        </div>
      </div>
      <div className="absolute top-3 right-4 flex items-center gap-4 z-10 text-[11px] font-mono">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-ink-600" /> 原始均值
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-alert-green" /> 反掩盖均值
        </span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-alert-orange/50 bg-alert-orange/10 text-alert-orange">
          阈值 {thresholdMm.toFixed(2)} mm
        </span>
      </div>

      <ResponsiveContainer width="100%" height="100%" className="pt-10">
        <ComposedChart
          data={data}
          margin={{ top: 20, right: 24, left: 8, bottom: 36 }}
          onClick={handleClick}
        >
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B35" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FF6B35" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 4" stroke="#1f4252" />
          <XAxis dataKey="timeLabel" tick={<CUSTOM_TICK />} axisLine={{ stroke: "#1f4252" }} tickLine={false} interval="preserveStartEnd" />
          <YAxis domain={[0, maxY]} tick={<CUSTOM_TICK />} axisLine={{ stroke: "#1f4252" }} tickLine={false} width={40} />
          <ZAxis dataKey="size" range={[40, 360]} />
          <ReferenceLine y={0} stroke="#1f4252" />
          <Tooltip
            cursor={{ stroke: "#1E6A88", strokeDasharray: "3 4" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as ChartPoint;
              const recs = result ? selectRecordsByBin(result, p.window) : [];
              return (
                <div className="bg-ink-900/95 border border-ink-700 rounded px-3 py-2 text-xs shadow-2xl backdrop-blur min-w-[240px]">
                  <div className="font-serif text-white text-sm mb-1.5">{label}</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
                    <div className="text-ink-600">反掩盖均值</div>
                    <div className="text-alert-green">{p.robustMean.toFixed(3)} mm</div>
                    <div className="text-ink-600">原始均值</div>
                    <div className="text-ink-400">{p.rawMean.toFixed(3)} mm</div>
                    <div className="text-ink-600">样本数</div>
                    <div className="text-white">{p.count}</div>
                    <div className="text-ink-600">异常 / 边界</div>
                    <div className="text-alert-red">{p.anomalousCount} / {p.boundaryCount}</div>
                  </div>
                  {p.hasStrongPull && (
                    <div className="mt-2 flex items-center gap-1 text-alert-orange text-[11px]">
                      ⚠ 含强拉动样本（已被反掩盖算法单独拎出）
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-ink-700/60 text-[11px] text-ink-600">
                    {selectedWindow === p.window ? "再次点击取消选中 · 共 " : "点击查看明细 · "}
                    {recs.length} 条样本
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="anomalousCount" barSize={18} fill="url(#barGrad)" radius={[2, 2, 0, 0]} opacity={0.85}>
            {data.map((d, i) => (
              <Cell
                key={i}
                opacity={filterKind === "all" || d.filterMatched ? 1 : 0.15}
                fill={d.hasStrongPull ? "#D72638" : "url(#barGrad)"}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="rawMean"
            stroke="#668899"
            strokeWidth={1.2}
            dot={false}
            strokeDasharray="4 3"
          />
          <Line
            type="monotone"
            dataKey="robustMean"
            stroke="#27A36E"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#27A36E", stroke: "#fff", strokeWidth: 1 }}
          />
          <Scatter dataKey="scatter" data={scatterData as any} isAnimationActive={false}>
            {(scatterData as any[]).map((s: any, i: number) => (
              <Cell
                key={i}
                fill={
                  s.status === "boundary"
                    ? "#F59E0B"
                    : s.isStrong
                      ? "#D72638"
                      : "#FF6B35"
                }
                stroke={selectedWindow === s.rawWindow ? "#fff" : "none"}
                strokeWidth={selectedWindow === s.rawWindow ? 2 : 0}
                opacity={0.9}
              />
            ))}
          </Scatter>
          {selectedWindow && (
            <ReferenceLine x={formatWindowLabel(selectedWindow)} stroke="#FF6B35" strokeWidth={1.5} strokeDasharray="3 2" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
