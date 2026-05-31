import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { useSettlementStore } from "@/store/settlementStore";
import { api } from "@/utils/api";
import { mapErrorMessage } from "@/utils/errorMessages";

export default function ExportCenter() {
  const { filter, selectedIds, getSerializedFilter, showToast } =
    useSettlementStore();

  const [exportScope, setExportScope] = useState<"filtered" | "selected">(
    "filtered"
  );
  const [includeNote, setIncludeNote] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filterParts: string[] = [];
  if (filter.store_name) filterParts.push(`门店：${filter.store_name}`);
  if (filter.activity_name) filterParts.push(`活动：${filter.activity_name}`);
  if (filter.settlement_period_start)
    filterParts.push(`期间起：${filter.settlement_period_start}`);
  if (filter.settlement_period_end)
    filterParts.push(`期间止：${filter.settlement_period_end}`);
  if (filter.status) {
    const statusLabels: Record<string, string> = {
      pending: "待确认",
      confirmed: "已确认",
      withdrawn: "已撤回",
      conflict: "异常冲突",
    };
    filterParts.push(`状态：${statusLabels[filter.status] || filter.status}`);
  }
  if (filter.amount_min !== undefined)
    filterParts.push(`最小金额：${filter.amount_min}`);
  if (filter.amount_max !== undefined)
    filterParts.push(`最大金额：${filter.amount_max}`);

  const reconciliationNote = `对账说明\n\n导出时间：${new Date().toLocaleString("zh-CN")}\n筛选条件：${filterParts.join("、") || "全部"}\n导出范围：${exportScope === "filtered" ? "按当前筛选条件" : `选中 ${selectedIds.size} 条记录`}\n\n本报表数据基于以上筛选条件生成，如有疑问请联系结算管理员。`;

  const handleExport = async () => {
    if (exportScope === "selected" && selectedIds.size === 0) {
      showToast("请先在结算明细页选择记录", "error");
      return;
    }

    setExporting(true);
    try {
      const blob = await api.exports.generate({
        filter: getSerializedFilter(),
        include_reconciliation_note: includeNote,
        export_scope: exportScope,
        selected_ids:
          exportScope === "selected" ? Array.from(selectedIds) : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `结算导出_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("导出成功");
    } catch (err) {
      showToast(mapErrorMessage(err), "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold text-slate-800">导出配置</h2>

        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-slate-500">
              导出范围
            </legend>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="exportScope"
                  value="filtered"
                  checked={exportScope === "filtered"}
                  onChange={() => setExportScope("filtered")}
                  className="h-4 w-4 border-slate-300 text-teal-700 focus:ring-teal-500"
                />
                <span className="text-sm text-slate-700">
                  按当前筛选条件导出
                </span>
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="exportScope"
                  value="selected"
                  checked={exportScope === "selected"}
                  onChange={() => setExportScope("selected")}
                  className="h-4 w-4 border-slate-300 text-teal-700 focus:ring-teal-500"
                />
                <span className="text-sm text-slate-700">
                  仅导出选中记录
                  {selectedIds.size > 0 && (
                    <span className="ml-1 text-xs text-teal-700">
                      （已选 {selectedIds.size} 条）
                    </span>
                  )}
                </span>
              </label>
            </div>
          </fieldset>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">
              当前筛选条件
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              {filterParts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {filterParts.map((part) => (
                    <span
                      key={part}
                      className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs text-teal-700"
                    >
                      {part}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">无筛选条件（将导出全部数据）</p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={includeNote}
              onChange={(e) => setIncludeNote(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-700">包含对账说明</span>
          </label>

          {includeNote && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <FileText className="h-3.5 w-3.5" />
                对账说明预览
              </div>
              <pre className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap">
                {reconciliationNote}
              </pre>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-6 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? "导出中..." : "导出 Excel"}
          </button>
        </div>
      </div>
    </div>
  );
}
