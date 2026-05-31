import { Check, Undo2, Download } from "lucide-react";
import { useSettlementStore } from "@/store/settlementStore";
import { api } from "@/utils/api";
import { mapErrorMessage } from "@/utils/errorMessages";

export default function BatchActionBar() {
  const {
    selectedIds,
    clearSelection,
    fetchRecords,
    getSerializedFilter,
    showToast,
  } = useSettlementStore();

  if (selectedIds.size === 0) return null;

  const handleBatchConfirm = async () => {
    try {
      const result = await api.batch.execute(
        Array.from(selectedIds),
        "confirm"
      );
      showToast(
        `批量确认完成：成功 ${result.success_count} 条，跳过 ${result.skipped_count} 条`
      );
      await fetchRecords();
      clearSelection();
    } catch (err) {
      showToast(mapErrorMessage(err), "error");
    }
  };

  const handleBatchWithdraw = async () => {
    const reason = prompt("请输入批量撤回原因：");
    if (!reason) return;
    try {
      const result = await api.batch.execute(
        Array.from(selectedIds),
        "withdraw",
        reason
      );
      showToast(
        `批量撤回完成：成功 ${result.success_count} 条，跳过 ${result.skipped_count} 条`
      );
      await fetchRecords();
      clearSelection();
    } catch (err) {
      showToast(mapErrorMessage(err), "error");
    }
  };

  const handleExportSelected = async () => {
    try {
      const blob = await api.exports.generate({
        filter: getSerializedFilter(),
        include_reconciliation_note: false,
        export_scope: "selected",
        selected_ids: Array.from(selectedIds),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `结算导出_选中${selectedIds.size}条.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("导出成功");
    } catch (err) {
      showToast(mapErrorMessage(err), "error");
    }
  };

  return (
    <div className="fixed bottom-0 left-56 right-0 z-30 animate-slide-up border-t border-teal-700/20 bg-white/95 px-6 py-3 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-700">
          已选择{" "}
          <span className="font-semibold text-teal-700 tabular-nums">
            {selectedIds.size}
          </span>{" "}
          条记录
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBatchConfirm}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            <Check className="h-4 w-4" />
            批量确认
          </button>
          <button
            onClick={handleBatchWithdraw}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-600 px-4 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            <Undo2 className="h-4 w-4" />
            批量撤回
          </button>
          <button
            onClick={handleExportSelected}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
          >
            <Download className="h-4 w-4" />
            导出选中
          </button>
          <button
            onClick={clearSelection}
            className="ml-2 text-sm text-slate-400 hover:text-slate-600"
          >
            取消选择
          </button>
        </div>
      </div>
    </div>
  );
}
