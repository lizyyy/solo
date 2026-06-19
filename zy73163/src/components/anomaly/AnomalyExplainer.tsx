import { useNavigate } from "react-router-dom";
import { AlertOctagon, StickyNote, SlidersHorizontal, ArrowUpRight } from "lucide-react";
import { useExplanationStore } from "@/store/useExplanationStore";
import { SOURCE_META } from "@/types";
import { cellKeyOf } from "@/utils/matrix";
import { SourceTag } from "@/components/ui/SourceTag";
import { Button } from "@/components/ui/Button";

export function AnomalyExplainer() {
  const navigate = useNavigate();
  const cells = useExplanationStore((s) => s.cells);
  const setFocus = useExplanationStore((s) => s.setFocus);
  const anomalies = cells.filter((c) => c.anomaly);

  const goNotes = (cellKey: string) => {
    setFocus({ cellKey });
    navigate("/notes");
  };

  const goCalcSpec = () => {
    setFocus({ calcSpecId: useExplanationStore.getState().currentCalcSpecId });
    const el = document.getElementById("calc-spec-bar");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("ring-2", "ring-anomaly");
    window.setTimeout(() => el?.classList.remove("ring-2", "ring-anomaly"), 1600);
  };

  return (
    <section className="paper-grain rise-in rounded-md border border-anomaly/50 bg-surface shadow-atlas">
      <header className="flex items-center justify-between gap-3 border-b border-anomaly/30 bg-anomaly-soft/50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-anomaly-soft text-anomaly">
            <AlertOctagon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">异常解释 · 先讲清</h2>
            <p className="text-xs text-ink-soft">
              图表进来先看这里。每条异常都能回到评分备注和本次计算口径。
            </p>
          </div>
        </div>
        <span className="font-mono-data text-xs text-anomaly">
          {anomalies.length} 项异常
        </span>
      </header>

      <ul className="divide-y divide-line">
        {anomalies.map((cell) => {
          const meta = SOURCE_META[cell.sourceType];
          return (
            <li
              key={`${cell.userId}-${cell.itemId}`}
              className="flex flex-wrap items-start gap-3 px-4 py-3"
            >
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: meta.colorVar }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-data text-sm font-semibold text-ink">
                    {cell.userId} × {cell.itemIdFull ?? cell.itemId}
                  </span>
                  <SourceTag type={cell.sourceType} />
                  {!cell.hasUnit && (
                    <span className="rounded-atlas border border-unit-missing/40 bg-unit-missing-soft px-1.5 py-0.5 font-mono-data text-[10px] uppercase tracking-wider text-unit-missing">
                      单位缺失
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {cell.anomalyReason ??
                    `误差 ${cell.error.toFixed(2)} 超阈值，预测 ${cell.predictedRating.toFixed(1)} 与观测 ${cell.actualRating?.toFixed(1) ?? "—"} 偏离。`}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 font-mono-data text-[11px] text-ink-mute">
                  <span>预测 {cell.predictedRating.toFixed(2)}</span>
                  <span>观测 {cell.actualRating != null ? cell.actualRating.toFixed(2) : "—"}</span>
                  <span className="text-anomaly">误差 {cell.error.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<StickyNote className="h-3.5 w-3.5" />}
                  onClick={() => goNotes(cellKeyOf(cell.userId, cell.itemId))}
                >
                  看备注
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                  onClick={goCalcSpec}
                >
                  看口径
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center justify-between border-t border-line bg-surface-2/50 px-4 py-2.5">
        <span className="font-mono-data text-[11px] text-ink-mute">
          点击异常格或按钮即可回溯 · 单位缺失项另进隔离区
        </span>
        <Button
          size="sm"
          variant="secondary"
          icon={<ArrowUpRight className="h-3.5 w-3.5" />}
          onClick={() => navigate("/quarantine")}
        >
          去隔离区
        </Button>
      </footer>
    </section>
  );
}
