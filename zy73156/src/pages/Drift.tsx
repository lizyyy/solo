import { Activity, AlertOctagon, Ban, Gauge } from "lucide-react";
import { useState } from "react";
import type { DriftEvent } from "@/data/types";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useOceanStore } from "@/store/useOceanStore";
import { GlassPanel, SectionHeader } from "@/components/ui/Primitives";
import DriftChart from "@/components/drift/DriftChart";
import SamplePicker from "@/components/history/SamplePicker";

const REASON_ICON: Record<DriftEvent["reasonKey"], typeof Ban> = {
  "over-limit": Gauge,
  spike: Activity,
  missing: AlertOctagon,
};

export default function Drift() {
  const samples = useOceanStore((s) => s.samples);
  const cockpitSelected = useOceanStore((s) => s.selectedSampleId);
  const [sampleId, setSampleId] = useState<string>(cockpitSelected ?? samples[0].id);
  const sample = samples.find((s) => s.id === sampleId)!;
  const threshold = sample.driftEvents[0]?.threshold ?? 2.0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/5 bg-abyss-950/50 px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4 text-block-rose" />
          <span className="hud-label">漂移分析 · DRIFT ANALYSIS</span>
          <span className="ml-auto font-mono text-[9px] text-slate-500">
            经得住一条传感器漂移 · 说清为什么被拦住
          </span>
        </div>
        <SamplePicker selectedId={sampleId} onSelect={setSampleId} />
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3">
        {/* chart */}
        <GlassPanel className="flex w-3/5 flex-col">
          <SectionHeader
            title={`传感器漂移曲线 · ${sample.code}`}
            icon={<Activity className="h-3.5 w-3.5" />}
            right={
              <span className="font-mono text-[10px] text-slate-400">
                阈值 {fmtNum(threshold, 1)} · 最大漂移{" "}
                <span className="text-block-rose">
                  {fmtNum(Math.max(...sample.readings.map((r) => r.drift)), 1)}
                </span>
              </span>
            }
          />
          <div className="px-3 pb-3">
            <DriftChart sample={sample} threshold={threshold} />
            <div className="mt-2 flex items-center justify-center gap-4 font-mono text-[9px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-ok-emerald" /> 正常
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-warn-amber" /> 预警
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-block-rose" /> 拦截
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-sm bg-block-rose/30" /> 拦截区间
              </span>
            </div>
          </div>
        </GlassPanel>

        {/* reasons */}
        <div className="flex w-2/5 flex-col gap-3 overflow-y-auto">
          {sample.driftEvents.length === 0 ? (
            <GlassPanel className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-ok-emerald" />
                <span className="hud-label text-ok-emerald">无漂移事件</span>
              </div>
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-400">
                {sample.code} 全程漂移低于阈值，传感器稳定，无拦截。
              </p>
            </GlassPanel>
          ) : (
            sample.driftEvents.map((d) => {
              const Icon = REASON_ICON[d.reasonKey];
              return (
                <GlassPanel key={d.id} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg",
                          d.blocked
                            ? "bg-block-rose/15 text-block-rose"
                            : "bg-warn-amber/15 text-warn-amber",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <div
                          className={cn(
                            "font-mono text-[11px] font-bold",
                            d.blocked ? "text-block-rose" : "text-warn-amber",
                          )}
                        >
                          {d.blocked ? "已拦截" : "未拦截 · 预警"}
                        </div>
                        <div className="font-mono text-[9px] text-slate-500">
                          {d.readingTimeLabel} · {d.reason}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* drift vs threshold bar */}
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between font-mono text-[9px]">
                      <span className="text-slate-500">漂移量</span>
                      <span className="text-slate-400">
                        <span className={d.blocked ? "text-block-rose" : "text-warn-amber"}>
                          {fmtNum(d.drift, 1)}
                        </span>{" "}
                        / 阈值 {fmtNum(d.threshold, 1)}
                      </span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-abyss-700">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          d.blocked ? "bg-block-rose" : "bg-warn-amber",
                        )}
                        style={{
                          width: `${Math.min(100, (d.drift / (d.threshold * 1.6)) * 100)}%`,
                        }}
                      />
                      <div
                        className="absolute top-0 h-full w-px bg-white/60"
                        style={{ left: `${(d.threshold / (d.threshold * 1.6)) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* reason */}
                  <div className="mt-3 rounded-lg border border-block-rose/20 bg-block-rose/[0.05] p-2.5">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Ban className="h-3 w-3 text-block-rose" />
                      <span className="hud-label text-block-rose/80">为什么被拦住</span>
                    </div>
                    <p className="font-mono text-[10px] leading-relaxed text-slate-300">
                      {d.blockedReason}
                    </p>
                  </div>
                </GlassPanel>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
