import { useState } from "react";
import { MoreHorizontal, Check, Undo2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useSettlementStore } from "@/store/settlementStore";
import { api } from "@/utils/api";
import { mapErrorMessage } from "@/utils/errorMessages";
import StatusBadge from "./StatusBadge";

export default function SettlementTable() {
  const {
    records,
    total,
    loading,
    filter,
    setFilter,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    fetchRecords,
    showToast,
  } = useSettlementStore();

  const [actionOpen, setActionOpen] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const allSelected = records.length > 0 && selectedIds.size === records.length;

  const handleConfirm = async (id: string) => {
    setActionLoading(true);
    try {
      await api.settlements.confirmById(id);
      showToast("确认成功");
      await fetchRecords();
      clearSelection();
    } catch (err) {
      showToast(mapErrorMessage(err), "error");
    } finally {
      setActionLoading(false);
      setActionOpen(null);
    }
  };

  const handleWithdraw = async (id: string) => {
    const reason = prompt("请输入撤回原因：");
    if (!reason) return;
    setActionLoading(true);
    try {
      await api.settlements.withdrawById(id, reason);
      showToast("撤回成功");
      await fetchRecords();
      clearSelection();
    } catch (err) {
      showToast(mapErrorMessage(err), "error");
    } finally {
      setActionLoading(false);
      setActionOpen(null);
    }
  };

  const totalPages = Math.ceil(total / filter.page_size);
  const startIdx = (filter.page - 1) * filter.page_size + 1;
  const endIdx = Math.min(filter.page * filter.page_size, total);

  const formatAmount = (val: number) =>
    val.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <span className="ml-3 text-sm text-slate-500">加载中...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl bg-white p-12 text-center shadow-sm">
        <p className="text-sm text-slate-400">暂无结算记录</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => (allSelected ? clearSelection() : selectAll())}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                />
              </th>
              <th className="px-4 py-3">门店</th>
              <th className="px-4 py-3">活动</th>
              <th className="px-4 py-3">结算期间</th>
              <th className="px-4 py-3">流水号</th>
              <th className="px-4 py-3 text-right">金额</th>
              <th className="px-4 py-3 text-right">手续费</th>
              <th className="px-4 py-3">手续费归属期</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, idx) => (
              <tr
                key={record.id}
                className={`border-b border-slate-100 transition-colors hover:bg-teal-50 ${
                  idx % 2 === 1 ? "bg-slate-50" : ""
                } ${selectedIds.has(record.id) ? "bg-teal-50/70" : ""}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(record.id)}
                    onChange={() => toggleSelect(record.id)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                  />
                </td>
                <td className="px-4 py-3 text-slate-800">{record.store_name}</td>
                <td className="px-4 py-3 text-slate-800">{record.activity_name}</td>
                <td className="px-4 py-3 text-slate-600">{record.settlement_period}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {record.serial_number}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-800">
                  {formatAmount(record.amount)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                  {formatAmount(record.handling_fee)}
                </td>
                <td className="px-4 py-3 text-slate-600">{record.handling_fee_period}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={record.status} />
                </td>
                <td className="relative px-4 py-3 text-center">
                  <button
                    onClick={() =>
                      setActionOpen(actionOpen === record.id ? null : record.id)
                    }
                    disabled={actionLoading}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {actionOpen === record.id && (
                    <div className="absolute right-4 top-full z-10 mt-1 w-28 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      {record.status === "pending" && (
                        <button
                          onClick={() => handleConfirm(record.id)}
                          disabled={actionLoading}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          确认
                        </button>
                      )}
                      {record.status === "confirmed" && (
                        <button
                          onClick={() => handleWithdraw(record.id)}
                          disabled={actionLoading}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Undo2 className="h-3.5 w-3.5 text-red-500" />
                          撤回
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
        <span className="text-xs text-slate-500 tabular-nums">
          显示 {startIdx}-{endIdx} 条，共 {total} 条
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter({ page: filter.page - 1 })}
            disabled={filter.page <= 1}
            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm tabular-nums text-slate-700">
            {filter.page} / {totalPages || 1}
          </span>
          <button
            onClick={() => setFilter({ page: filter.page + 1 })}
            disabled={filter.page >= totalPages}
            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
