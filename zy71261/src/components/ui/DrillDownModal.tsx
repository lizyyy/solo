import { useMemo } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useTermWallStore } from "@/store/useTermWallStore";
import { getVarietySummary } from "@/utils/aggregate";

function PositionTable({ recordIds }: { recordIds: string[] }) {
  const positions = useTermWallStore((s) => s.positions);
  const records = useMemo(
    () => positions.filter((p) => recordIds.includes(p.id)),
    [positions, recordIds]
  );

  const marginCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      if (r.margin == null) continue;
      const key = `${r.direction}::${r.margin}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [records]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-[#2d3548]">
            <th className="text-left py-1.5 pr-2">方向</th>
            <th className="text-right py-1.5 pr-2">保证金</th>
            <th className="text-right py-1.5 pr-2">数量</th>
            <th className="text-left py-1.5">风险报告</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const isDup =
              r.margin != null &&
              (marginCounts.get(`${r.direction}::${r.margin}`) ?? 0) > 1;
            return (
              <tr
                key={r.id}
                className={`border-b border-[#2d3548]/50 ${isDup ? "bg-red-500/10" : ""}`}
              >
                <td
                  className={`py-1.5 pr-2 ${
                    r.direction === "long" ? "text-[#ff6b35]" : "text-[#00d4aa]"
                  }`}
                >
                  {r.direction === "long" ? "多头" : "空头"}
                </td>
                <td className="text-right py-1.5 pr-2 text-slate-300">
                  {(r.margin ?? 0).toLocaleString()}
                </td>
                <td className="text-right py-1.5 pr-2 text-slate-300">
                  {(r.quantity ?? 0).toLocaleString()}
                </td>
                <td className="py-1.5 text-slate-500">{r.riskReport ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConcentrationIndicator() {
  const { selectedBlock, aggregatedBlocks } = useTermWallStore();
  const summary = useMemo(() => getVarietySummary(aggregatedBlocks), [aggregatedBlocks]);

  if (!selectedBlock) return null;

  const varietyTotal = summary.find(
    (s) => s.varietyCode === selectedBlock.varietyCode
  );
  const total = varietyTotal
    ? varietyTotal.longMargin + varietyTotal.shortMargin
    : 0;
  const pct = total > 0 ? ((selectedBlock.totalMargin / total) * 100).toFixed(1) : "0";

  return (
    <div className="bg-[#0f1623] rounded-lg p-3 border border-[#2d3548]">
      <div className="text-xs font-medium text-slate-300 mb-1.5">集中度指标</div>
      <div className="text-xs text-slate-400">
        占品种总保证金（已去重）:{" "}
        <span className="text-white font-medium">{pct}%</span>
      </div>
      {selectedBlock.duplicateMargin > 0 && (
        <div className="text-[10px] text-red-400 mt-1">
          已排除重复保证金 {selectedBlock.duplicateMargin.toLocaleString()}（{selectedBlock.duplicateCount}笔）
        </div>
      )}
      <div className="mt-1.5 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${Math.min(Number(pct), 100)}%` }}
        />
      </div>
    </div>
  );
}

function CrossMonthWarnings() {
  const { selectedBlock, validation } = useTermWallStore();
  if (!selectedBlock || !validation) return null;

  const warnings = validation.crossMonthRollWarnings.filter(
    (w) =>
      w.clientId === selectedBlock.clientId &&
      w.varietyCode === selectedBlock.varietyCode
  );

  if (warnings.length === 0) return null;

  return (
    <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
      <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 mb-1.5">
        <AlertTriangle size={12} />
        跨月移仓预警
      </div>
      <div className="flex flex-wrap gap-1.5">
        {warnings.map((w, i) => (
          <span
            key={i}
            className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px]"
          >
            {w.fromMonth} → {w.toMonth} ({w.netChangePercent}%)
          </span>
        ))}
      </div>
    </div>
  );
}

function DuplicateWarning() {
  const { selectedBlock, validation } = useTermWallStore();
  if (!selectedBlock || !validation) return null;

  const dups = validation.duplicateMarginEntries.filter(
    (d) =>
      d.clientId === selectedBlock.clientId &&
      d.varietyCode === selectedBlock.varietyCode &&
      d.contractMonth === selectedBlock.contractMonth
  );

  if (dups.length === 0) return null;

  return (
    <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400 mb-1">
        <AlertTriangle size={12} />
        保证金重复检测
      </div>
      {dups.map((d, i) => (
        <div key={i} className="text-[10px] text-amber-300/80">
          {d.direction}方向: {d.duplicateCount}笔重复, 单笔金额{" "}
          {d.marginAmount.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

export default function DrillDownModal() {
  const { drillDownOpen, selectedBlock, closeDrillDown } = useTermWallStore();

  if (!drillDownOpen || !selectedBlock) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={closeDrillDown}
    >
      <div
        className="bg-[#1a1f2e] rounded-xl border border-[#2d3548] shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2d3548]">
          <span className="text-sm font-medium text-slate-200">
            风险钻取 - {selectedBlock.clientName} {selectedBlock.varietyName}{" "}
            {selectedBlock.contractMonth === "__MISSING__" ? "未标注月份" : selectedBlock.contractMonth}
          </span>
          <button onClick={closeDrillDown} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="bg-[#0f1623] rounded-lg p-3 border border-[#2d3548]">
            <div className="text-xs font-medium text-slate-300 mb-2">持仓明细</div>
            <PositionTable recordIds={selectedBlock.recordIds} />
          </div>
          <ConcentrationIndicator />
          <CrossMonthWarnings />
          <DuplicateWarning />
        </div>

        <div className="px-5 py-3 border-t border-[#2d3548] flex justify-end">
          <button
            onClick={closeDrillDown}
            className="px-4 py-1.5 rounded bg-[#2d3548] text-xs text-slate-300 hover:bg-[#3a4258]"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
