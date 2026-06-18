import { GitCompareArrows, History as HistoryIcon, ShieldCheck, UserCog } from "lucide-react";
import { useMemo, useState } from "react";
import type { Sample } from "@/data/types";
import { RECORD_KIND_META } from "@/data/types";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useOceanStore } from "@/store/useOceanStore";
import { GlassPanel, SectionHeader } from "@/components/ui/Primitives";
import SamplePicker from "@/components/history/SamplePicker";
import VersionCard from "@/components/history/VersionCard";

export default function History() {
  const samples = useOceanStore((s) => s.samples);
  const cockpitSelected = useOceanStore((s) => s.selectedSampleId);
  const [sampleId, setSampleId] = useState<string>(cockpitSelected ?? samples[0].id);
  const [versionId, setVersionId] = useState<string>("");

  const sample: Sample | undefined = samples.find((s) => s.id === sampleId);
  const versions = sample?.versions ?? [];
  const activeVersion =
    versions.find((v) => v.id === versionId) ?? versions[versions.length - 1];
  const manualEdits = useMemo(
    () => versions.filter((v) => v.manualEdited),
    [versions],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* picker */}
      <div className="shrink-0 border-b border-white/5 bg-abyss-950/50 px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <HistoryIcon className="h-4 w-4 text-glow-cyan" />
          <span className="hud-label">历史版本台 · 选择采样材料</span>
          <span className="ml-auto font-mono text-[9px] text-slate-500">
            重跑同一材料时，按版本标签区分 旧处理 / 后补备注 / 最新导出
          </span>
        </div>
        <SamplePicker selectedId={sampleId} onSelect={setSampleId} />
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3">
        {/* timeline */}
        <GlassPanel className="flex w-1/2 flex-col">
          <SectionHeader
            title="版本时间线 · VERSION TIMELINE"
            icon={<HistoryIcon className="h-3.5 w-3.5" />}
            right={
              sample && (
                <span className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[9px]", RECORD_KIND_META[sample.kind].bg)}>
                  {RECORD_KIND_META[sample.kind].label}
                </span>
              )
            }
          />
          <div className="relative overflow-y-auto px-4 pb-4">
            <div className="absolute bottom-4 left-7 top-10 w-px bg-gradient-to-b from-glow-cyan/30 via-white/10 to-transparent" />
            {versions.map((v, i) => (
              <VersionCard
                key={v.id}
                version={v}
                index={i}
                active={activeVersion?.id === v.id}
                onSelect={() => setVersionId(v.id)}
              />
            ))}
          </div>
        </GlassPanel>

        {/* right: audit + detail */}
        <div className="flex w-1/2 flex-col gap-3 overflow-y-auto">
          {/* shift audit */}
          <GlassPanel className="p-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-ok-emerald" />
              <span className="hud-label">换班前审计 · MANUAL TRACE</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                <div className="stat-num text-lg font-bold text-slate-200">
                  {versions.length}
                </div>
                <div className="hud-label text-[8px]">版本总数</div>
              </div>
              <div className="rounded-lg border border-warn-amber/20 bg-warn-amber/[0.05] p-2.5">
                <div className="stat-num text-lg font-bold text-warn-amber">
                  {manualEdits.length}
                </div>
                <div className="hud-label text-[8px] text-warn-amber/70">人工修改步骤</div>
              </div>
              <div className="rounded-lg border border-block-rose/20 bg-block-rose/[0.05] p-2.5">
                <div className="stat-num text-lg font-bold text-block-rose">
                  {sample?.driftEvents.filter((d) => d.blocked).length ?? 0}
                </div>
                <div className="hud-label text-[8px] text-block-rose/70">拦截事件</div>
              </div>
            </div>

            {manualEdits.length > 0 ? (
              <div className="mt-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <UserCog className="h-3 w-3 text-warn-amber" />
                  <span className="hud-label">被人工改过的步骤</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {manualEdits.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-lg border border-warn-amber/20 bg-warn-amber/[0.04] px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-warn-amber">
                          {v.changedField}
                        </span>
                        <span className="font-mono text-[9px] text-slate-500">
                          {fmtNum(v.valueBefore ?? 0)} → {fmtNum(v.valueAfter ?? 0)}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] text-slate-400">
                        {v.changedBy} · {fmtDateTime(v.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-ok-emerald/20 bg-ok-emerald/[0.04] px-3 py-2 font-mono text-[10px] text-ok-emerald">
                ✓ 全程自动处理，无人工修改步骤
              </div>
            )}
          </GlassPanel>

          {/* version detail / comparison */}
          {activeVersion && (
            <GlassPanel className="p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCompareArrows className="h-4 w-4 text-glow-cyan" />
                  <span className="hud-label">版本详情 · {activeVersion.layerLabel}</span>
                </div>
                <span className="font-mono text-[9px] text-slate-500">
                  {fmtDateTime(activeVersion.createdAt)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                  <div className="hud-label text-[8px]">处理人</div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-200">
                    {activeVersion.changedBy}
                  </div>
                  <div className="font-mono text-[9px] text-slate-500">
                    {activeVersion.changedByRole}
                  </div>
                </div>
                <div
                  className={cn(
                    "rounded-lg border p-2.5",
                    activeVersion.manualEdited
                      ? "border-warn-amber/20 bg-warn-amber/[0.04]"
                      : "border-white/5 bg-white/[0.02]",
                  )}
                >
                  <div className="hud-label text-[8px]">处理方式</div>
                  <div
                    className={cn(
                      "mt-0.5 font-mono text-[11px]",
                      activeVersion.manualEdited ? "text-warn-amber" : "text-ok-emerald",
                    )}
                  >
                    {activeVersion.manualEdited ? "人工修改" : "自动处理"}
                  </div>
                </div>
              </div>

              <p className="mt-2 rounded-lg border border-white/5 bg-abyss-950/40 p-2.5 font-mono text-[10px] leading-relaxed text-slate-400">
                {activeVersion.note}
              </p>
            </GlassPanel>
          )}
        </div>
      </div>
    </div>
  );
}
