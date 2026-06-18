import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Edit3,
  GitCompare,
  History,
  RefreshCw,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useTimeFormatter } from "@/hooks/useTimeFormatter";
import { StatusBadge } from "./StatusBadge";
import { useState } from "react";

const TRIGGER_LABEL: Record<string, { icon: React.ReactNode; text: string }> = {
  auto: { icon: <Zap className="h-3 w-3" />, text: "自动生成" },
  supplement_rerun: { icon: <UploadCloud className="h-3 w-3" />, text: "补录重跑" },
  manual_rerun: { icon: <Edit3 className="h-3 w-3" />, text: "人工重跑" },
};

export function HistoryDrawer() {
  const {
    historyDrawerOpen,
    toggleHistoryDrawer,
    history,
    activeVersionTag,
    setActiveVersion,
  } = usePlaybackStore();
  const { fmtFull, fmtDuration } = useTimeFormatter();
  const [diffPair, setDiffPair] = useState<[string, string] | null>(null);

  if (!historyDrawerOpen) return null;

  const current = history.find((h) => h.versionTag === activeVersionTag) ?? history[history.length - 1];

  const buildDiff = () => {
    if (!diffPair) return null;
    const a = history.find((h) => h.versionTag === diffPair[0]);
    const b = history.find((h) => h.versionTag === diffPair[1]);
    if (!a || !b) return null;
    const keys = new Set([
      ...Object.keys(a.spec.unitConversions),
      ...Object.keys(b.spec.unitConversions),
    ]);
    const allThresh = new Set([
      ...Object.keys(a.spec.thresholds),
      ...Object.keys(b.spec.thresholds),
    ]);
    return {
      a,
      b,
      unitDiffs: Array.from(keys).map((k) => ({
        key: k,
        a: a.spec.unitConversions[k] ?? "—",
        b: b.spec.unitConversions[k] ?? "—",
        changed: a.spec.unitConversions[k] !== b.spec.unitConversions[k],
      })),
      threshDiffs: Array.from(allThresh).map((k) => ({
        key: k,
        a: a.spec.thresholds[k]?.join("~") ?? "—",
        b: b.spec.thresholds[k]?.join("~") ?? "—",
        changed:
          JSON.stringify(a.spec.thresholds[k]) !== JSON.stringify(b.spec.thresholds[k]),
      })),
      fieldsA: a.spec.involvedFields,
      fieldsB: b.spec.involvedFields,
      formulaA: a.spec.formula,
      formulaB: b.spec.formula,
    };
  };

  const diff = buildDiff();

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-ocean-950/70 backdrop-blur-sm"
        onClick={() => toggleHistoryDrawer(false)}
      />
      <aside className="pointer-events-auto ml-auto flex h-full w-[520px] max-w-full flex-col border-l border-white/10 bg-ocean-950/90 shadow-card">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ocean-700/60">
              <History className="h-4 w-4 text-tide-400" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                历史版本与重跑
              </h3>
              <p className="text-[11px] text-ink-300">
                {history.length} 个版本 · 连续 · 人工修改高亮
              </p>
            </div>
          </div>
          <button
            className="rounded-lg p-1.5 text-ink-200 transition hover:bg-white/10 hover:text-white"
            onClick={() => toggleHistoryDrawer(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!diff ? (
            <ol className="relative space-y-4 border-l border-white/10 pl-6">
              {[...history].reverse().map((v, idx, arr) => {
                const isActive = v.versionTag === activeVersionTag;
                const isLatest = idx === 0;
                return (
                  <li key={v.id} className="relative">
                    <span
                      className={`absolute -left-[30px] top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        isActive
                          ? "border-tide-500 bg-ocean-950"
                          : "border-white/20 bg-ocean-950"
                      }`}
                    >
                      {v.hasManualEdit ? (
                        <Edit3 className="h-3 w-3 text-alert-amber" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 text-tide-500" />
                      )}
                    </span>
                    <div
                      className={`glass-card cursor-pointer p-4 transition hover:border-white/20 ${
                        isActive ? "border-tide-500/40" : ""
                      }`}
                      onClick={() => setActiveVersion(v.versionTag)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-white">
                            {v.versionTag}
                          </span>
                          {isLatest && <StatusBadge kind="ok" text="最新" />}
                          {v.hasManualEdit && (
                            <StatusBadge kind="pending" text="人工改过" />
                          )}
                          {v.continuityReport.hasGaps && (
                            <StatusBadge kind="anomaly" text="存在断档" />
                          )}
                        </div>
                        <span className="chip">
                          {TRIGGER_LABEL[v.trigger].icon}
                          {TRIGGER_LABEL[v.trigger].text}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-ink-300">
                        {v.createdBy} · {fmtFull(v.createdAt)}
                      </p>

                      {v.hasManualEdit && v.manualEditFields && (
                        <div className="mt-2">
                          <p className="text-[11px] text-ink-300">人工修改字段</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {v.manualEditFields.map((f) => (
                              <span
                                key={f}
                                className="rounded-md border border-alert-amber/30 bg-alert-amber/10 px-1.5 py-0.5 font-mono text-[10px]"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {v.continuityReport.hasGaps ? (
                        <div className="mt-2 rounded-lg border border-alert-red/30 bg-alert-red/5 p-2">
                          <p className="flex items-center gap-1 text-[11px] text-alert-red">
                            <AlertTriangle className="h-3 w-3" /> 数据断档
                          </p>
                          <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-ink-200">
                            {v.continuityReport.gaps.map((g, i) => (
                              <li key={i}>
                                {fmtFull(g.from)} → {fmtFull(g.to)}（{fmtDuration(g.durationMs)}）
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-tide-400">
                          <CheckCircle2 className="h-3 w-3" /> 时序连续，无断档
                        </div>
                      )}

                      {arr.length > 1 && idx < arr.length - 1 && (
                        (() => {
                          const prev = arr[idx + 1];
                          return (
                            <button
                              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-ink-100 transition hover:bg-white/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDiffPair([prev.versionTag, v.versionTag]);
                              }}
                            >
                              <GitCompare className="h-3 w-3" /> 对比 {prev.versionTag} → {v.versionTag}
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          );
                        })()
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="space-y-4">
              <button
                className="btn-ghost"
                onClick={() => setDiffPair(null)}
              >
                <RefreshCw className="h-4 w-4" /> 返回版本列表
              </button>

              <div className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-sm font-semibold text-white">
                    口径对比
                  </h4>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-ink-300">{diff.a.versionTag}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-ink-500" />
                    <span className="text-tide-400">{diff.b.versionTag}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] gap-2 text-xs">
                  <DiffRow label="公式" a={diff.formulaA} b={diff.formulaB} changed={diff.formulaA !== diff.formulaB} mono />
                  <DiffRow
                    label="参与字段"
                    a={diff.fieldsA.join(", ")}
                    b={diff.fieldsB.join(", ")}
                    changed={JSON.stringify(diff.fieldsA) !== JSON.stringify(diff.fieldsB)}
                  />
                </div>

                <h5 className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
                  单位转换
                </h5>
                <div className="mt-2 space-y-1.5">
                  {diff.unitDiffs.map((r) => (
                    <DiffRow key={r.key} label={r.key} a={r.a} b={r.b} changed={r.changed} mono />
                  ))}
                </div>

                <h5 className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
                  阈值区间
                </h5>
                <div className="mt-2 space-y-1.5">
                  {diff.threshDiffs.map((r) => (
                    <DiffRow key={r.key} label={r.key} a={r.a} b={r.b} changed={r.changed} mono />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {current && !diff && (
          <div className="border-t border-white/10 p-4">
            <p className="text-[11px] text-ink-300">
              当前版本
              <span className="ml-1 font-mono text-tide-400">{current.versionTag}</span>
              <span className="mx-1">·</span>
              <span>{current.createdBy}</span>
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function DiffRow({
  label,
  a,
  b,
  changed,
  mono,
}: {
  label: string;
  a: string;
  b: string;
  changed: boolean;
  mono?: boolean;
}) {
  return (
    <>
      <div className="flex items-center text-ink-300">{label}</div>
      <div className="px-2 text-ink-500">→</div>
      <div className={`rounded-md px-2 py-0.5 ${changed ? "bg-alert-amber/15 text-alert-amber" : "text-white"} ${mono ? "font-mono text-[11px]" : "text-xs"}`}>
        {changed ? (
          <>
            <span className="line-through opacity-60">{a}</span>{" "}
            <span className="font-semibold">{b}</span>
          </>
        ) : (
          b
        )}
      </div>
    </>
  );
}
