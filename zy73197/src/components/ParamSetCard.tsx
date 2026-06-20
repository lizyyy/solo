import { cn } from "@/lib/utils";
import type { ParamSet } from "@/engine/types";
import { useStore } from "@/store/useStore";
import { ParamRow } from "./ParamRow";

interface Props {
  set: ParamSet;
}

export function ParamSetCard({ set }: Props) {
  const setSource = useStore((s) => s.setSource);
  const blockedCount = set.params.filter(
    (p) => p.status === "blocked" || p.status === "unit_missing",
  ).length;
  const isA = set.id === "A";

  return (
    <section className="border border-line bg-carbon-900/50">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span
          className={cn(
            "grid h-7 w-7 place-items-center font-display text-sm font-extrabold",
            isA ? "bg-amber text-carbon-950" : "border border-bone/40 text-bone",
          )}
        >
          {set.id}
        </span>
        <div className="min-w-0">
          <div className="font-display text-sm font-bold tracking-tightest text-bone">
            {set.label}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-ash">parameter set</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="font-mono text-[10px] uppercase tracking-widest text-ash">来源</label>
          <input
            value={set.source}
            onChange={(e) => setSource(set.id, e.target.value)}
            className="w-32 border border-line bg-carbon-950/60 px-2 py-1 font-mono text-[11px] text-bone outline-none focus:border-amber/60"
            placeholder="字段来源"
          />
        </div>
      </header>

      <div className="grid grid-cols-[1.1fr_110px_92px_104px] gap-2 border-b border-line px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-ash">
        <span>参数 · 来源字段</span>
        <span>取值</span>
        <span>单位</span>
        <span>处理状态</span>
      </div>

      <div className="divide-amber-line px-4">
        {set.params.map((p) => (
          <ParamRow key={p.key} group={set.id} param={p} />
        ))}
      </div>

      <footer className="flex items-center justify-between border-t border-line px-4 py-2 font-mono text-[10px] text-ash">
        <span>{set.params.length} 个参数</span>
        <span className={cn(blockedCount > 0 && "text-block")}>
          {blockedCount > 0 ? `${blockedCount} 项拦截` : "全部就绪"}
        </span>
      </footer>
    </section>
  );
}
