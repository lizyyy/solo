import AlertRow from "./AlertRow";
import { useReviewStore } from "@/store/reviewStore";
import { FileWarning } from "lucide-react";

export default function AlertTable() {
  const getFilteredRecords = useReviewStore((s) => s.getFilteredRecords);
  const records = getFilteredRecords();

  return (
    <div className="card-surface border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="table-header-cell w-10"></th>
              <th className="table-header-cell min-w-[160px]">统一设备编号</th>
              <th className="table-header-cell min-w-[120px]">原始编号写法</th>
              <th className="table-header-cell min-w-[150px]">来源</th>
              <th className="table-header-cell min-w-[180px]">叶片角度 vs 阈值</th>
              <th className="table-header-cell min-w-[180px]">振动水平 vs 阈值</th>
              <th className="table-header-cell min-w-[100px]">临时调整</th>
              <th className="table-header-cell min-w-[100px]">处理状态</th>
              <th className="table-header-cell min-w-[140px]">更新时间</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <FileWarning size={48} strokeWidth={1.5} />
                    <p className="text-lg font-medium">暂无匹配的记录</p>
                    <p className="text-sm">尝试调整筛选条件或重置过滤器</p>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((record, idx) => (
                <AlertRow key={record.id} record={record} index={idx} />
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 bg-surface-muted border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
        <span>
          显示 <span className="font-mono font-semibold text-industrial-600">{records.length}</span> 条 / 共{" "}
          <span className="font-mono font-semibold">{useReviewStore.getState().records.length}</span> 条记录
        </span>
        <span>提示：点击任意行可查看详情，左侧三角可展开异常拉动因素</span>
      </div>
    </div>
  );
}
