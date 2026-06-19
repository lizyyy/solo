import { useMemo, useState } from "react";
import { History, GitCompare, Tag, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useFittingStore } from "@/stores/fittingStore";
import { FORMULA_LABELS } from "@/engine/curveFitting";
import { clsx } from "clsx";

export default function ParamVersionList() {
  const s = useFittingStore();
  const [mode, setMode] = useState<"list" | "compare">("list");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-ember-500" />
          <h3 className="card-title !text-sm">参数版本管理</h3>
        </div>
        <div className="flex items-center gap-1 text-xs bg-ink-50 p-0.5 rounded-sm2 border border-ink-100">
          <button
            onClick={() => setMode("list")}
            className={clsx("px-2 py-1 rounded-sm", mode === "list" ? "bg-white text-ink-800 shadow-sm" : "text-ink-500 hover:text-ink-700")}
          >列表</button>
          <button
            onClick={() => setMode("compare")}
            className={clsx("px-2 py-1 rounded-sm flex items-center gap-1", mode === "compare" ? "bg-white text-ink-800 shadow-sm" : "text-ink-500 hover:text-ink-700")}
          >
            <GitCompare className="w-3 h-3" /> 对比
          </button>
        </div>
      </div>
      <div className="p-3">
        {mode === "list" ? (
          <div className="space-y-2">
            {s.paramVersions.map((p) => {
              const active = p.id === s.currentParamId;
              return (
                <div
                  key={p.id}
                  className={clsx(
                    "p-3 rounded-sm2 border transition-all",
                    active ? "bg-ink-800 text-white border-ink-800 shadow-card" : "bg-white border-ink-200 hover:border-ink-300",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className={clsx("w-4 h-4", active ? "text-amber-200" : "text-ember-500")} />
                      <span className="font-serif font-medium text-sm">{p.name}</span>
                      {active && <span className="chip !bg-white/15 !text-white !border-white/20">当前</span>}
                    </div>
                    <button
                      onClick={() => s.setCurrentParam(p.id)}
                      disabled={active}
                      className={clsx(
                        "btn-ghost !py-0.5 !px-2 !text-xs",
                        active ? "!text-ink-300 !cursor-default" : active ? "" : "!bg-white/10 !text-white",
                        !active && "!bg-ink-50 !text-ink-700 hover:!bg-ink-100",
                      )}
                    >
                      <CheckCircle2 className="w-3 h-3" /> 切换到此版本
                    </button>
                  </div>
                  <div className={clsx("text-[11px] mt-1", active ? "text-ink-200" : "text-ink-500")}>
                    {p.createdBy} · {p.createdAt}
                  </div>
                  <div className={clsx("text-xs mt-2 grid grid-cols-3 gap-2", active ? "text-ink-100" : "text-ink-700")}>
                    <div>
                      <div className="opacity-60 text-[10px] uppercase">公式</div>
                      <div className="font-mono mt-0.5">{FORMULA_LABELS[p.formula].short}</div>
                    </div>
                    <div>
                      <div className="opacity-60 text-[10px] uppercase">x 范围</div>
                      <div className="font-mono mt-0.5">
                        [{p.boundaryTable.find(b=>b.variable==="x")?.min}, {p.boundaryTable.find(b=>b.variable==="x")?.max}]
                      </div>
                    </div>
                    <div>
                      <div className="opacity-60 text-[10px] uppercase">y 范围</div>
                      <div className="font-mono mt-0.5">
                        [{p.boundaryTable.find(b=>b.variable==="y")?.min}, {p.boundaryTable.find(b=>b.variable==="y")?.max}]
                      </div>
                    </div>
                  </div>
                  <div className={clsx("text-xs mt-2 p-2 rounded-sm", active ? "bg-white/10" : "bg-paper border border-slate2-200 text-ink-600")}>
                    {p.note}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <CompareView
            ids={compareIds}
            toggle={(id) => setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-2))}
          />
        )}
      </div>
    </div>
  );
}

function CompareView({ ids, toggle }: { ids: string[]; toggle: (id: string) => void }) {
  const s = useFittingStore();
  const items = s.paramVersions;
  const selected = items.filter(p => ids.includes(p.id));
  const diffs = useMemo(() => {
    if (selected.length !== 2) return null;
    const [a, b] = selected;
    return {
      formula: a.formula !== b.formula,
      xRange: JSON.stringify(a.boundaryTable.find(x => x.variable === "x")) !== JSON.stringify(b.boundaryTable.find(x => x.variable === "x")),
      yRange: JSON.stringify(a.boundaryTable.find(x => x.variable === "y")) !== JSON.stringify(b.boundaryTable.find(x => x.variable === "y")),
      note: a.note !== b.note,
    };
  }, [selected]);

  return (
    <div className="space-y-3">
      <div className="text-xs text-ink-500">请选择 2 个版本进行对比（已选 {ids.length}/2）</div>
      <div className="space-y-1.5">
        {items.map(p => (
          <label
            key={p.id}
            className={clsx(
              "flex items-center gap-2 p-2 rounded-sm2 border cursor-pointer transition-all",
              ids.includes(p.id) ? "bg-ember-50 border-ember-300" : "bg-white border-ink-100 hover:border-ink-300",
            )}
          >
            <input type="checkbox" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} className="accent-ember-500" />
            <span className="font-serif text-sm text-ink-800">{p.name}</span>
            <span className="ml-auto text-[10px] text-ink-500">{p.createdAt}</span>
          </label>
        ))}
      </div>
      {selected.length === 2 && diffs && (
        <div className="mt-3 border border-ink-200 rounded-sm2 overflow-hidden">
          <div className="grid grid-cols-[1fr_40px_1fr] text-xs bg-ink-50 border-b border-ink-100">
            <div className="p-2 font-medium text-ink-700">{selected[0].name}</div>
            <div className="p-2 flex items-center justify-center bg-ink-100 text-ink-500">vs</div>
            <div className="p-2 font-medium text-ink-700 text-right">{selected[1].name}</div>
          </div>
          {(["formula", "xRange", "yRange", "note"] as const).map((key) => {
            const labels: Record<string, string> = { formula: "拟合公式", xRange: "x 阈值范围", yRange: "y 阈值范围", note: "版本备注" };
            const vals = (() => {
              if (key === "formula") return [FORMULA_LABELS[selected[0].formula].short, FORMULA_LABELS[selected[1].formula].short];
              if (key === "xRange") {
                const r = (p: typeof selected[0]) => {
                  const b = p.boundaryTable.find(x => x.variable === "x");
                  return b ? `[${b.min}, ${b.max}] ±${b.tolerancePct}%` : "—";
                };
                return [r(selected[0]), r(selected[1])];
              }
              if (key === "yRange") {
                const r = (p: typeof selected[0]) => {
                  const b = p.boundaryTable.find(x => x.variable === "y");
                  return b ? `[${b.min}, ${b.max}] ±${b.tolerancePct}%` : "—";
                };
                return [r(selected[0]), r(selected[1])];
              }
              return [selected[0].note ?? "—", selected[1].note ?? "—"];
            })();
            const highlight = diffs[key];
            return (
              <div key={key} className="grid grid-cols-[1fr_40px_1fr] text-xs border-b border-ink-50 last:border-0">
                <div className={clsx("p-2 font-mono", highlight && "bg-yellow-100/60")}>
                  {vals[0]}
                </div>
                <div className="p-2 flex items-center justify-center bg-ink-50 text-[10px] text-ink-500 whitespace-nowrap">
                  {labels[key]}
                </div>
                <div className={clsx("p-2 font-mono text-right", highlight && "bg-yellow-100/60")}>
                  {vals[1]}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
