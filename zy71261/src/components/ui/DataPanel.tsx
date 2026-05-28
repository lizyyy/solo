import { useMemo } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { useTermWallStore } from "@/store/useTermWallStore";
import { getVarietySummary } from "@/utils/aggregate";

function DetailCard() {
  const { selectedBlock, hoveredBlock } = useTermWallStore();
  const block = selectedBlock ?? hoveredBlock;

  if (!block) {
    return (
      <div className="bg-[#0f1623] rounded-lg p-3 border border-[#1e293b]">
        <div className="text-xs text-slate-500 text-center py-4">点击方块查看详情</div>
      </div>
    );
  }

  const missingFields: string[] = [];
  if (block.fieldFlags.clientIdMissing) missingFields.push("客户ID");
  if (block.fieldFlags.contractMonthMissing) missingFields.push("合约月份");
  if (block.fieldFlags.directionMissing) missingFields.push("方向");
  if (block.fieldFlags.marginMissing) missingFields.push("保证金");

  return (
    <div className="bg-[#0f1623] rounded-lg p-3 border border-[#1e293b] space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300">选中明细</span>
        {block.hasMissingFields && (
          <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
            <AlertTriangle size={10} />
            含缺失字段
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span className="text-slate-500">品种</span>
        <span className="text-slate-200">{block.varietyName}</span>
        <span className="text-slate-500">合约月份</span>
        <span className="text-slate-200">{block.contractMonth}</span>
        <span className="text-slate-500">方向</span>
        <span className={block.direction === "long" ? "text-[#ff6b35]" : "text-[#00d4aa]"}>
          {block.direction === "long" ? "多头" : "空头"}
        </span>
        <span className="text-slate-500">客户</span>
        <span className="text-slate-200">{block.clientName} ({block.clientId})</span>
        <span className="text-slate-500">保证金</span>
        <span className="text-slate-200">{block.totalMargin.toLocaleString()}</span>
        <span className="text-slate-500">数量</span>
        <span className="text-slate-200">{block.totalQuantity.toLocaleString()}</span>
      </div>
      {missingFields.length > 0 && (
        <div className="text-[10px] text-amber-400 pt-1 border-t border-[#1e293b]">
          缺失: {missingFields.join("、")}
        </div>
      )}
    </div>
  );
}

function VarietySummaryTable() {
  const aggregatedBlocks = useTermWallStore((s) => s.aggregatedBlocks);
  const summary = useMemo(() => getVarietySummary(aggregatedBlocks), [aggregatedBlocks]);

  return (
    <div className="bg-[#0f1623] rounded-lg p-3 border border-[#1e293b]">
      <div className="text-xs font-medium text-slate-300 mb-2">品种汇总</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left py-0.5">品种</th>
              <th className="text-right py-0.5 text-[#ff6b35]">多</th>
              <th className="text-right py-0.5 text-[#00d4aa]">空</th>
              <th className="text-right py-0.5">净</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((s) => (
              <tr key={s.varietyCode} className="border-t border-[#1e293b]/50">
                <td className="py-0.5 text-slate-300">{s.varietyCode}</td>
                <td className="text-right text-slate-400">{s.longMargin.toLocaleString()}</td>
                <td className="text-right text-slate-400">{s.shortMargin.toLocaleString()}</td>
                <td className={`text-right ${s.netMargin >= 0 ? "text-white" : "text-red-400"}`}>
                  {s.netMargin.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MissingFieldsWarning() {
  const aggregatedBlocks = useTermWallStore((s) => s.aggregatedBlocks);
  const counts = useMemo(() => {
    let clientId = 0, contractMonth = 0, direction = 0, margin = 0;
    for (const b of aggregatedBlocks) {
      if (b.fieldFlags.clientIdMissing) clientId++;
      if (b.fieldFlags.contractMonthMissing) contractMonth++;
      if (b.fieldFlags.directionMissing) direction++;
      if (b.fieldFlags.marginMissing) margin++;
    }
    return { clientId, contractMonth, direction, margin };
  }, [aggregatedBlocks]);

  const total = counts.clientId + counts.contractMonth + counts.direction + counts.margin;
  if (total === 0) return null;

  return (
    <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400 mb-1.5">
        <AlertTriangle size={12} />
        缺失字段警示
      </div>
      <div className="text-[10px] text-amber-300/70 space-y-0.5">
        {counts.clientId > 0 && <div>客户ID缺失: {counts.clientId} 个方块</div>}
        {counts.contractMonth > 0 && <div>合约月份缺失: {counts.contractMonth} 个方块</div>}
        {counts.direction > 0 && <div>方向缺失: {counts.direction} 个方块</div>}
        {counts.margin > 0 && <div>保证金缺失: {counts.margin} 个方块</div>}
      </div>
    </div>
  );
}

function ProcessInfo() {
  const { lastProcessedAt, dataHash } = useTermWallStore();
  return (
    <div className="bg-[#0f1623] rounded-lg p-3 border border-[#1e293b] space-y-1">
      <div className="text-xs font-medium text-slate-300">上次处理</div>
      <div className="text-[10px] text-slate-500">
        {lastProcessedAt
          ? new Date(lastProcessedAt).toLocaleString("zh-CN")
          : "未处理"}
      </div>
      <div className="text-[10px] text-slate-600 font-mono">
        {dataHash ? `${dataHash.slice(0, 8)}...${dataHash.slice(-4)}` : ""}
      </div>
    </div>
  );
}

function ExportList() {
  const exportRecords = useTermWallStore((s) => s.exportRecords);
  const recent = exportRecords.slice(-5).reverse();

  if (recent.length === 0) return null;

  return (
    <div className="bg-[#0f1623] rounded-lg p-3 border border-[#1e293b]">
      <div className="text-xs font-medium text-slate-300 mb-2">导出记录</div>
      <div className="space-y-1.5">
        {recent.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">
              {new Date(r.timestamp).toLocaleString("zh-CN")}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] ${
                r.format === "csv"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-blue-500/20 text-blue-400"
              }`}
            >
              {r.format.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DataPanel() {
  const { dataPanelOpen, toggleDataPanel } = useTermWallStore();

  if (!dataPanelOpen) {
    return (
      <div className="flex flex-col items-center py-4 w-10 bg-[#111827] border-l border-[#1e293b]">
        <button onClick={toggleDataPanel} className="text-slate-400 hover:text-white p-1">
          <ChevronLeft size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-[#111827] border-l border-[#1e293b] flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-3 border-b border-[#1e293b]">
        <span className="text-sm font-medium text-slate-300">数据面板</span>
        <button onClick={toggleDataPanel} className="text-slate-400 hover:text-white p-1">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="px-3 py-3 space-y-3 flex-1">
        <DetailCard />
        <VarietySummaryTable />
        <MissingFieldsWarning />
        <ProcessInfo />
        <ExportList />
      </div>
    </div>
  );
}
