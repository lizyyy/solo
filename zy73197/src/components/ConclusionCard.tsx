import { useState } from "react";
import { Play, ShieldCheck, FileText, RefreshCw, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import { StatusBadge } from "./StatusBadge";
import { fmt } from "@/engine/markdown";

export function ConclusionCard() {
  const result = useStore((s) => s.result);
  const dirty = useStore((s) => s.dirty);
  const draftId = useStore((s) => s.draftId);
  const run = useStore((s) => s.run);
  const confirmLatest = useStore((s) => s.confirmLatest);
  const toggleReport = useStore((s) => s.toggleReport);

  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");

  const gA = result.groups.A;
  const gB = result.groups.B;
  const aVal = gA.finalValue != null ? fmt(gA.finalValue) : "—";
  const bVal = gB.finalValue != null ? fmt(gB.finalValue) : "—";
  const delta = result.delta != null ? `${result.delta >= 0 ? "+" : ""}${fmt(result.delta)}` : "—";
  const deltaPct = result.deltaPct != null ? `${result.deltaPct >= 0 ? "+" : ""}${fmt(result.deltaPct, 1)}%` : "—";

  const canConfirm = !result.blockReason || draftId != null;

  return (
    <section className="relative overflow-hidden border border-line bg-carbon-900/50 p-5">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-sm font-bold tracking-wide text-bone">归因结论</h2>
        <StatusBadge kind="result" status={result.status} />
        {dirty && (
          <span className="font-mono text-[10px] text-warn">参数已改动 · 建议重跑</span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={run}
            className="inline-flex items-center gap-1.5 border border-amber/60 bg-amber/10 px-3 py-1.5 font-mono text-[12px] text-amber transition-colors hover:bg-amber/20"
          >
            <Play className="h-3.5 w-3.5" /> 重新归因
          </button>
          <button
            onClick={() => setConfirming(true)}
            disabled={!canConfirm}
            className={cn(
              "inline-flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[12px] transition-colors",
              canConfirm
                ? "border-pass/50 bg-pass/10 text-pass hover:bg-pass/20"
                : "cursor-not-allowed border-line text-ash",
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> 人工确认
          </button>
          <button
            onClick={() => toggleReport(true)}
            className="inline-flex items-center gap-1.5 border border-line bg-carbon-800/50 px-3 py-1.5 font-mono text-[12px] text-bone transition-colors hover:border-amber/40"
          >
            <FileText className="h-3.5 w-3.5" /> Markdown 报告
          </button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="border border-line bg-carbon-950/50 p-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ash">A 组得分</div>
          <div className={cn("mt-1 font-mono text-2xl tnum", gA.blocked ? "text-block" : "text-bone")}>
            {aVal} <span className="text-sm text-ash">分</span>
          </div>
        </div>
        <div className="border border-line bg-carbon-950/50 p-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ash">B 组得分</div>
          <div className={cn("mt-1 font-mono text-2xl tnum", gB.blocked ? "text-block" : "text-bone")}>
            {bVal} <span className="text-sm text-ash">分</span>
          </div>
        </div>
        <div className="border border-amber/30 bg-amber/5 p-3">
          <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-ash">
            <ArrowLeftRight className="h-3 w-3" /> 差值 A − B
          </div>
          <div className="mt-1 font-mono text-2xl text-amber tnum">{delta}</div>
          <div className="font-mono text-[11px] text-ash tnum">占比 {deltaPct}</div>
        </div>
      </div>

      {result.blockReason && (
        <div className="mt-4 border border-block/40 bg-block/5 p-3">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-block">
            拦截说明 · 为什么被拦住
          </div>
          <p className="font-mono text-[12px] leading-relaxed text-block/90">{result.blockReason}</p>
        </div>
      )}

      {confirming && (
        <div className="mt-4 border border-pass/40 bg-pass/5 p-4">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-pass">
            人工确认 · 留住确认前后变化（供灰度回放）
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="灰度发布备注（可选）：如『已与排班核对，A组耗时单位由分改秒』"
            className="w-full resize-none border border-line bg-carbon-950/60 px-2 py-1.5 font-mono text-[12px] text-bone outline-none focus:border-pass/60"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="inline-flex items-center gap-1 border border-line px-2.5 py-1 font-mono text-[11px] text-ash hover:text-bone"
            >
              取消
            </button>
            <button
              onClick={() => {
                confirmLatest(note);
                setNote("");
                setConfirming(false);
              }}
              className="inline-flex items-center gap-1 border border-pass/60 bg-pass/20 px-2.5 py-1 font-mono text-[11px] text-pass hover:bg-pass/30"
            >
              <RefreshCw className="h-3 w-3" /> 确认并归档
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
