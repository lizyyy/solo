import { useState } from "react";
import { History as HistoryIcon, Trash2, ShieldCheck, GitCompareArrows, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { StatusBadge } from "@/components/StatusBadge";
import { DiffView, DiffLegend } from "@/components/DiffView";
import { fmt } from "@/engine/markdown";

function fmtTs(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function History() {
  const history = useStore((s) => s.history);
  const clearHistory = useStore((s) => s.clearHistory);
  const [selectedId, setSelectedId] = useState<string | null>(history[0]?.id ?? null);

  const selected = history.find((h) => h.id === selectedId) ?? history[0];

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-ash">
            attribution · history & grayscale
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tightest text-bone">
            历史与灰度
          </h1>
          <p className="mt-1 text-[12px] text-ash">
            留住人工确认前后的变化；灰度发布前回放 diff，讲给排班同事听。
          </p>
        </div>
        <button
          onClick={clearHistory}
          className="inline-flex items-center gap-1.5 border border-line bg-carbon-900/50 px-3 py-1.5 font-mono text-[12px] text-ash hover:border-block/50 hover:text-block"
        >
          <Trash2 className="h-3.5 w-3.5" /> 清空历史
        </button>
      </header>

      {history.length === 0 ? (
        <div className="grid place-items-center border border-dashed border-line py-20 text-center">
          <HistoryIcon className="mb-3 h-8 w-8 text-ash/50" />
          <p className="font-mono text-[13px] text-ash">暂无历史。前往工作台执行「重新归因」即可生成记录。</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="border border-line bg-carbon-900/40">
            <div className="border-b border-line px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ash">
              归因记录 · {history.length}
            </div>
            <ul className="max-h-[70vh] overflow-y-auto">
              {history.map((h) => {
                const active = h.id === selected?.id;
                return (
                  <li key={h.id}>
                    <button
                      onClick={() => setSelectedId(h.id)}
                      className={cn(
                        "flex w-full items-start gap-2 border-b border-line/60 px-3 py-2.5 text-left transition-colors",
                        active ? "bg-amber/10" : "hover:bg-carbon-800/40",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1 h-2 w-2 shrink-0",
                          h.confirmed ? "bg-pass" : "bg-ash",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-bone tnum">{fmtTs(h.ts)}</span>
                          {h.confirmed && (
                            <ShieldCheck className="h-3 w-3 text-pass" />
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <StatusBadge kind="result" status={h.result.status} />
                          {h.confirmed && h.diffs.length > 0 && (
                            <span className="font-mono text-[10px] text-amber">
                              {h.diffs.length} 项变更
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {selected && (
            <section className="space-y-4">
              <div className="border border-line bg-carbon-900/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <StatusBadge kind="result" status={selected.result.status} />
                  {selected.confirmed ? (
                    <StatusBadge kind="plain" status="confirm" />
                  ) : (
                    <span className="font-mono text-[11px] text-ash">自动归因 · 待人工确认</span>
                  )}
                  <span className="ml-auto font-mono text-[11px] text-ash tnum">{fmtTs(selected.ts)}</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="border border-line bg-carbon-950/50 p-2.5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ash">A 组得分</div>
                    <div className="font-mono text-lg tnum text-bone">
                      {selected.result.groups.A.finalValue != null
                        ? fmt(selected.result.groups.A.finalValue)
                        : "—"}
                    </div>
                  </div>
                  <div className="border border-line bg-carbon-950/50 p-2.5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ash">B 组得分</div>
                    <div className="font-mono text-lg tnum text-bone">
                      {selected.result.groups.B.finalValue != null
                        ? fmt(selected.result.groups.B.finalValue)
                        : "—"}
                    </div>
                  </div>
                  <div className="border border-amber/30 bg-amber/5 p-2.5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ash">差值 A−B</div>
                    <div className="font-mono text-lg tnum text-amber">
                      {selected.result.delta != null
                        ? `${selected.result.delta >= 0 ? "+" : ""}${fmt(selected.result.delta)}`
                        : "—"}
                    </div>
                  </div>
                </div>

                {selected.result.blockReason && (
                  <div className="mt-3 border border-block/40 bg-block/5 p-2.5 font-mono text-[12px] leading-relaxed text-block/90">
                    <span className="font-bold">拦截说明：</span>
                    {selected.result.blockReason}
                  </div>
                )}
              </div>

              <div className="border border-line bg-carbon-900/50 p-4">
                <header className="mb-3 flex items-center gap-2">
                  <GitCompareArrows className="h-4 w-4 text-amber" />
                  <h2 className="font-display text-sm font-bold tracking-wide text-bone">
                    人工确认前后变化
                  </h2>
                  <div className="ml-auto">
                    <DiffLegend />
                  </div>
                </header>

                {selected.confirmed ? (
                  <DiffView diffs={selected.diffs} />
                ) : (
                  <p className="py-2 font-mono text-[12px] text-ash">
                    该记录为自动归因结果，尚未人工确认。前往工作台执行「人工确认」后，确认前后的变化将留痕于此。
                  </p>
                )}
              </div>

              {selected.confirmed && selected.grayscaleNote && (
                <div className="border border-pass/30 bg-pass/5 p-4">
                  <header className="mb-1.5 flex items-center gap-2">
                    <StickyNote className="h-3.5 w-3.5 text-pass" />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-pass">
                      灰度发布备注
                    </span>
                  </header>
                  <p className="font-mono text-[12px] leading-relaxed text-bone/90">
                    {selected.grayscaleNote}
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
