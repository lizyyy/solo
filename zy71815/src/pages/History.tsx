import { useEffect, useState } from "react";
import { useSettlementStore } from "@/store/settlementStore";
import OperationTimeline from "@/components/OperationTimeline";

export default function History() {
  const { operationLogs, fetchHistory } = useSettlementStore();
  const [operationType, setOperationType] = useState<string>("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleFilter = () => {
    const filters: Record<string, string> = {};
    if (operationType) filters.operation_type = operationType;
    if (dateStart) filters.date_start = dateStart;
    if (dateEnd) filters.date_end = dateEnd;
    fetchHistory(filters);
  };

  const handleReset = () => {
    setOperationType("");
    setDateStart("");
    setDateEnd("");
    fetchHistory();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[140px]">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              操作类型
            </label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">全部</option>
              <option value="import">导入</option>
              <option value="confirm">确认</option>
              <option value="withdraw">撤回</option>
              <option value="modify">修正</option>
            </select>
          </div>

          <div className="min-w-[140px]">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              起始日期
            </label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="min-w-[140px]">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              截止日期
            </label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleFilter}
              className="inline-flex h-9 items-center rounded-lg bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800"
            >
              筛选
            </button>
            <button
              onClick={handleReset}
              className="inline-flex h-9 items-center rounded-lg border border-teal-700 px-4 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold text-slate-800">
          操作记录
        </h2>
        <OperationTimeline logs={operationLogs} />
      </div>
    </div>
  );
}
