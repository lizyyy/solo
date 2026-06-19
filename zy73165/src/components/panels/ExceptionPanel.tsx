import { useMemo } from "react";
import { Undo2, AlertCircle, BookmarkMinus, AlertTriangle, ChevronRight, ChevronDown } from "lucide-react";
import { useFittingStore } from "@/stores/fittingStore";

const GROUP_DEF = [
  { type: "withdrawn", label: "撤回记录", color: "neutral", Icon: Undo2 },
  { type: "unit_missing", label: "单位缺失", color: "fail", Icon: AlertCircle },
  { type: "boundary", label: "边界样本", color: "warn", Icon: BookmarkMinus },
  { type: "high_deviation", label: "偏差>5%", color: "warn", Icon: AlertTriangle },
] as const;

const THRESHOLD_DEV = 5;

export default function ExceptionPanel() {
  const s = useFittingStore();
  const fitting = s.fitting;

  const groups = useMemo(() => {
    const withdrawnRows = s.rows.filter((r) => r.status === "withdrawn");
    const missingRows = s.rows.filter((r) => r.status === "unit_missing");
    const boundaryRows = s.rows.filter((r) => r.status === "boundary");
    const devRows = s.rows
      .map((r) => ({ r, res: fitting?.perRow.find((p) => p.rowId === r.id) }))
      .filter((x) => x.res && x.res.usedInFitting && Math.abs(x.res.deviationPct) > THRESHOLD_DEV)
      .map((x) => x.r);

    return [
      { type: "withdrawn", label: "撤回记录", rows: withdrawnRows },
      { type: "unit_missing", label: "单位缺失", rows: missingRows },
      { type: "boundary", label: "边界样本", rows: boundaryRows },
      { type: "high_deviation", label: `偏差 > ${THRESHOLD_DEV}%`, rows: devRows },
    ] as const;
  }, [s.rows, fitting]);

  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <h3 className="card-title !text-sm">异常点聚合</h3>
          <span className={`chip ${total > 0 ? "chip-warn" : "chip-pass"}`}>
            共 {total} 条待关注
          </span>
        </div>
        <span className="text-[11px] text-ink-500">点击展开查看明细，可跳转复核视图深入追溯</span>
      </div>
      <div className="divide-y divide-ink-50">
        {groups.map((g, idx) => {
          const def = GROUP_DEF[idx];
          const { Icon } = def;
          const openKey = `exc_${g.type}`;
          const open = !!s.explainOpen[openKey];
          return (
            <div key={g.type}>
              <button
                onClick={() => s.toggleExplain(openKey)}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-ink-50/70 transition-colors"
              >
                <span className={`w-7 h-7 rounded-sm2 flex items-center justify-center ${
                  g.rows.length === 0 ? "bg-ink-100 text-ink-400" :
                  def.color === "fail" ? "bg-red-500/15 text-red-600" :
                  def.color === "warn" ? "bg-ember-500/15 text-ember-600" :
                  "bg-ink-100 text-ink-600"
                }`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="flex-1 text-left">
                  <span className="text-sm text-ink-800 font-medium">{g.label}</span>
                  <span className="divider-dot text-ink-300" />
                  <span className="text-xs text-ink-500">
                    {g.rows.length > 0 ? `${g.rows.map(r => r.studentId).join("·")}` : "无此类异常"}
                  </span>
                </span>
                <span className={`chip ${
                  g.rows.length === 0 ? "chip-neutral" :
                  def.color === "fail" ? "chip-fail" :
                  def.color === "warn" ? "chip-warn" : "chip-neutral"
                }`}>
                  {g.rows.length}
                </span>
                {open ? (
                  <ChevronDown className="w-4 h-4 text-ink-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-ink-400" />
                )}
              </button>
              {open && g.rows.length > 0 && (
                <div className="px-4 pb-3 pt-1 border-t border-ink-50 bg-paper/50 space-y-1.5">
                  {g.rows.map((r) => (
                    <ExceptionRow key={r.id} type={g.type} rowId={r.id} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExceptionRow({ type, rowId }: { type: string; rowId: string }) {
  const s = useFittingStore();
  const row = s.rows.find((r) => r.id === rowId);
  const res = s.fitting?.perRow.find((p) => p.rowId === rowId);
  if (!row) return null;

  const reason = (() => {
    switch (type) {
      case "withdrawn":
        return row.withdrawReason ?? "无理由记录";
      case "unit_missing":
        return row.unitConfirmReason ?? "尚未处理：请点击表格中的「确认单位」";
      case "boundary":
        return s.boundaryDetails[rowId] ?? "命中边界容差带，详见行级详情。";
      case "high_deviation":
        return `拟合偏差 ${res ? res.deviationPct.toFixed(2) : "—"}%，超过阈值 ${THRESHOLD_DEV}%。`;
      default:
        return "";
    }
  })();

  return (
    <div
      className="flex items-start gap-3 p-2 rounded-sm2 border border-ink-100 bg-white cursor-pointer hover:border-ink-300 transition-colors"
      onClick={() => {
        s.toggleExplain(`row_${rowId}`);
        document.getElementById(`row-anchor-${rowId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
    >
      <div className="font-mono text-xs text-ink-500 w-16 shrink-0">#{row.seqNo}·{row.studentId}</div>
      <div className="flex-1 text-xs text-ink-700">{reason}</div>
    </div>
  );
}
