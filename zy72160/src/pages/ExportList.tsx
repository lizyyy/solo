import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Filter, RotateCcw, Search } from "lucide-react";
import { api } from "../utils/api";
import { useAppStore } from "../store/app.store";
import StatusBadge from "../components/StatusBadge";
import EvidenceTag from "../components/EvidenceTag";
import type { MergedPoint, Anomaly } from "../../shared/types";

export default function ExportList() {
  const { currentBatch, exportFilters, setExportFilters, resetExportFilters, addToast } = useAppStore();
  const [points, setPoints] = useState<MergedPoint[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const batchId = currentBatch?.id;

  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    Promise.all([api.merge.listPoints(batchId), api.anomalies.list(batchId)])
      .then(([pts, anoms]) => { setPoints(pts); setAnomalies(anoms); })
      .catch(() => addToast("error", "加载导出数据失败"))
      .finally(() => setLoading(false));
  }, [batchId]);

  const anomalyMap = useMemo(() => {
    const m = new Map<string, Anomaly>();
    anomalies.forEach((a) => m.set(a.mergedPointId, a));
    return m;
  }, [anomalies]);

  const filtered = useMemo(() => {
    return points.filter((p) => {
      if (exportFilters.businessType && !p.businessType.includes(exportFilters.businessType)) return false;
      if (exportFilters.conflictStatus && exportFilters.conflictStatus !== "all" && p.conflictStatus !== exportFilters.conflictStatus) return false;
      return true;
    });
  }, [points, exportFilters]);

  const handleExport = async (format: "excel" | "pdf") => {
    if (!batchId) return;
    setExporting(true);
    try {
      const blob = await api.exports.download(batchId, { batchId, filters: exportFilters, format });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${batchId}.${format === "excel" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("success", `导出${format === "excel" ? "Excel" : "PDF"}成功`);
    } catch {
      addToast("error", "导出失败");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card"><div className="card-body"><div className="skeleton h-10 w-full" /></div></div>
        <div className="card"><div className="card-body space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
        </div></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Filter className="w-4 h-4 text-ochre" />
          <span className="section-title text-sm">筛选条件</span>
        </div>
        <div className="card-body flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">业态</label>
            <input className="input-base" placeholder="输入业态关键词" value={exportFilters.businessType}
              onChange={(e) => setExportFilters({ businessType: e.target.value })} />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">冲突状态</label>
            <select className="select-base" value={exportFilters.conflictStatus || "all"}
              onChange={(e) => setExportFilters({ conflictStatus: e.target.value })}>
              <option value="all">全部</option>
              <option value="none">正常</option>
              <option value="conflict">冲突</option>
              <option value="resolved">已决</option>
            </select>
          </div>
          <button className="btn-primary flex items-center gap-1.5" onClick={() => {}}>
            <Search className="w-4 h-4" />查询
          </button>
          <button className="btn-ghost flex items-center gap-1.5" onClick={resetExportFilters}>
            <RotateCcw className="w-4 h-4" />重置
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0 overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">暂无数据，请先完成数据导入和归并</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-3 py-2.5 font-medium">编号</th>
                  <th className="px-3 py-2.5 font-medium">地址</th>
                  <th className="px-3 py-2.5 font-medium">业态</th>
                  <th className="px-3 py-2.5 font-medium">面积</th>
                  <th className="px-3 py-2.5 font-medium">来源</th>
                  <th className="px-3 py-2.5 font-medium">状态</th>
                  <th className="px-3 py-2.5 font-medium w-48">异常说明</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const anomaly = anomalyMap.get(p.id);
                  return (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-mono text-xs">{p.gisId}</td>
                      <td className="px-3 py-2.5">{p.address}</td>
                      <td className="px-3 py-2.5">{p.businessType}</td>
                      <td className="px-3 py-2.5">{p.area} ㎡</td>
                      <td className="px-3 py-2.5"><div className="flex gap-1 flex-wrap">{p.sources.map((s) => <EvidenceTag key={s.id} sourceType={s.sourceType} />)}</div></td>
                      <td className="px-3 py-2.5"><StatusBadge status={p.conflictStatus} /></td>
                      <td className="px-3 py-2.5 text-gray-500">{anomaly?.humanReadable || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">共 {filtered.length} 条记录</span>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-1.5" disabled={exporting} onClick={() => handleExport("excel")}>
            <FileSpreadsheet className="w-4 h-4" />{exporting ? "导出中..." : "导出 Excel"}
          </button>
          <button className="btn-primary flex items-center gap-1.5" disabled={exporting} onClick={() => handleExport("pdf")}>
            <FileText className="w-4 h-4" />{exporting ? "导出中..." : "导出 PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
