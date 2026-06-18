import { useNavigate } from "react-router-dom";
import { Crosshair, GitBranch, Layers, PenLine, TrendingUp } from "lucide-react";
import type { Reading, Sample } from "@/data/types";
import {
  RECORD_KIND_META,
  READING_STATUS_META,
  VERSION_LAYER_META,
} from "@/data/types";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useOceanStore } from "@/store/useOceanStore";
import { STATIONS } from "@/store/useOceanStore";
import { GlassPanel, SectionHeader } from "@/components/ui/Primitives";

function Sparkline({ readings, index }: { readings: Reading[]; index: number }) {
  const w = 260;
  const h = 56;
  const values = readings.map((r) => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = readings.map((r, i) => {
    const x = (i / (readings.length - 1)) * (w - 8) + 4;
    const y = h - 6 - ((r.value - min) / range) * (h - 16);
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const avgY = h - 6 - ((readings[0].avg - min) / range) * (h - 16);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <line
        x1="0"
        x2={w}
        y1={avgY}
        y2={avgY}
        stroke="#475569"
        strokeWidth="0.8"
        strokeDasharray="3 3"
      />
      <path d={path} fill="none" stroke="#22D3EE" strokeWidth="1.5" />
      {pts.map((p, i) => {
        const r = readings[i];
        const active = i === index;
        const c =
          r.status === "blocked"
            ? "#FB7185"
            : r.status === "warning"
              ? "#F59E0B"
              : "#34D399";
        return (
          <circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={active ? 3.5 : 2}
            fill={c}
            stroke={active ? "#fff" : "none"}
            strokeWidth={active ? 1 : 0}
          />
        );
      })}
    </svg>
  );
}

export default function ObjectDetailPanel() {
  const navigate = useNavigate();
  const selectedId = useOceanStore((s) => s.selectedSampleId);
  const timeIndex = useOceanStore((s) => s.timeIndex);
  const samples = useOceanStore((s) => s.samples);

  const sample: Sample | undefined = samples.find((s) => s.id === selectedId);
  if (!sample) {
    return (
      <GlassPanel className="flex-1 p-4">
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <Crosshair className="h-6 w-6 text-slate-600" />
          <p className="font-mono text-[11px] text-slate-500">
            在 3D 场景中点选一个采样对象
          </p>
          <p className="font-mono text-[9px] text-slate-600">
            查看逐时刻读数 · 漂移 · 版本链
          </p>
        </div>
      </GlassPanel>
    );
  }

  const reading = sample.readings[timeIndex];
  const station = STATIONS.find((st) => st.id === sample.stationId);
  const kindMeta = RECORD_KIND_META[sample.kind];
  const statusMeta = READING_STATUS_META[reading.status];
  const manualVersions = sample.versions.filter((v) => v.manualEdited);

  return (
    <GlassPanel className="flex-1 overflow-y-auto">
      <SectionHeader
        title="对象详情 · OBJECT"
        icon={<Crosshair className="h-3.5 w-3.5" />}
        right={
          <span className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[9px]", kindMeta.bg)}>
            {kindMeta.label}
          </span>
        }
      />
      <div className="px-3.5 pb-3.5">
        {/* header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[13px] font-bold text-slate-100">{sample.code}</div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-400">
              {station?.name} · {sample.anomalyTypeLabel} · {sample.depth}m
            </div>
          </div>
          <div className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1", statusMeta.color, "border-current/30 bg-current/5")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
            <span className="font-mono text-[10px]">{statusMeta.label}</span>
          </div>
        </div>

        {/* current value */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { label: "当前读数", value: reading.value, hi: true },
            { label: "平均值", value: reading.avg },
            { label: "最大值", value: reading.max },
            { label: "最小值", value: reading.min },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
              <div className="hud-label text-[8px]">{m.label}</div>
              <div
                className={cn(
                  "stat-num mt-0.5 text-[13px] font-bold",
                  m.hi ? statusMeta.color : "text-slate-300",
                )}
              >
                {fmtNum(m.value)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] text-slate-500">
          <span>时刻 {reading.timeLabel}</span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            漂移 {fmtNum(reading.drift)}
          </span>
        </div>

        {/* sparkline */}
        <div className="mt-2 rounded-lg border border-white/5 bg-abyss-950/40 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="hud-label text-[8px]">逐时刻读数趋势</span>
            <span className="font-mono text-[8px] text-slate-600">
              虚线=平均 · 点=各时刻
            </span>
          </div>
          <Sparkline readings={sample.readings} index={timeIndex} />
        </div>

        {/* version chain */}
        <div className="mt-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-glow-cyan" />
            <span className="hud-label">版本链 · 旧处理 → 后补备注 → 最新导出</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {sample.versions.map((v) => {
              const meta = VERSION_LAYER_META[v.layer];
              return (
                <div
                  key={v.id}
                  className={cn(
                    "rounded-lg border p-2",
                    v.manualEdited
                      ? "border-warn-amber/40 bg-warn-amber/[0.06]"
                      : "border-white/5 bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                      <span className={cn("font-mono text-[10px] font-semibold", meta.color)}>
                        {meta.label}
                      </span>
                      {v.manualEdited && (
                        <span className="flex items-center gap-0.5 rounded bg-warn-amber/15 px-1 py-0.5 font-mono text-[8px] text-warn-amber">
                          <PenLine className="h-2 w-2" /> 人工修改
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[8px] text-slate-600">{v.changedBy}</span>
                  </div>
                  <p className="mt-1 font-mono text-[9px] leading-relaxed text-slate-400">
                    {v.summary}
                  </p>
                  {v.manualEdited && v.changedField && (
                    <div className="mt-1 flex items-center gap-1.5 rounded bg-abyss-950/50 px-1.5 py-1 font-mono text-[9px]">
                      <span className="text-slate-500">{v.changedField}:</span>
                      <span className="text-block-rose line-through">
                        {fmtNum(v.valueBefore ?? 0)}
                      </span>
                      <span className="text-slate-600">→</span>
                      <span className="text-ok-emerald">{fmtNum(v.valueAfter ?? 0)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => navigate("/history")}
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-glow-cyan/30 bg-glow-cyan/5 py-1.5 font-mono text-[10px] text-glow-cyan transition hover:bg-glow-cyan/15"
          >
            <GitBranch className="h-3 w-3" /> 进入历史版本台对比
          </button>
        </div>

        {/* drift events */}
        {sample.driftEvents.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-block-rose" />
              <span className="hud-label">漂移事件</span>
            </div>
            {sample.driftEvents.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-block-rose/30 bg-block-rose/[0.06] p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-block-rose">
                    {d.blocked ? "已拦截" : "未拦截·预警"}
                  </span>
                  <span className="font-mono text-[9px] text-slate-400">
                    {d.readingTimeLabel} · 漂移 {fmtNum(d.drift)}/{fmtNum(d.threshold)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[9px] leading-relaxed text-slate-400">
                  {d.blockedReason}
                </p>
                <button
                  onClick={() => navigate("/drift")}
                  className="mt-1.5 w-full rounded-md border border-block-rose/30 bg-block-rose/5 py-1 font-mono text-[9px] text-block-rose transition hover:bg-block-rose/15"
                >
                  查看漂移分析 →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
