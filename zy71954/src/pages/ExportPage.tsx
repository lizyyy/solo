import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import type { AnomalyTag, Sortie, SortieStatus } from "@/types";
import {
  Filter, Download, Camera, Map, ClipboardCheck, Activity,
  AlertTriangle, FileJson, FileText, Search, RotateCcw,
} from "lucide-react";

const STATUS_OPTIONS: { value: SortieStatus; label: string; color: string }[] = [
  { value: "normal", label: "正常", color: "bg-green-400" },
  { value: "pending", label: "待确认", color: "bg-yellow-400" },
  { value: "abnormal", label: "异常", color: "bg-red-400" },
];

const ANOMALY_OPTIONS: { value: AnomalyTag; label: string }[] = [
  { value: "battery_cycle_error", label: "电池循环错算" },
  { value: "nofly_zone_edge", label: "禁飞区擦边" },
  { value: "rth_point_lost", label: "返航点丢失" },
  { value: "other", label: "其他" },
];

function EvidenceIcons({ sortieId }: { sortieId: string }) {
  const { photos, kmlRoutes, confirmations, flightReviews } = useAppStore();
  const has = (arr: { sortieId: string }[]) => arr.some((x) => x.sortieId === sortieId);
  const items: { ok: boolean; Icon: typeof Camera }[] = [
    { ok: has(photos), Icon: Camera },
    { ok: has(kmlRoutes), Icon: Map },
    { ok: has(confirmations), Icon: ClipboardCheck },
    { ok: has(flightReviews), Icon: Activity },
  ];
  return (
    <span className="flex gap-1.5">
      {items.map(({ ok, Icon }, i) => (
        <Icon key={i} size={14} className={ok ? "text-green-400" : "text-gray-600"} />
      ))}
    </span>
  );
}

function useFilteredSorties() {
  const { sorties, filters } = useAppStore();
  return useMemo(() => {
    return sorties.filter((s) => {
      if (filters.status.length && !filters.status.includes(s.status)) return false;
      if (filters.anomalyTags.length && !filters.anomalyTags.some((t) => s.anomalyTags.includes(t))) return false;
      if (filters.dateRange.start && s.timestamp < filters.dateRange.start) return false;
      if (filters.dateRange.end && s.timestamp > filters.dateRange.end) return false;
      if (filters.batteryId && !s.batteryId.toLowerCase().includes(filters.batteryId.toLowerCase())) return false;
      if (filters.sortieNo && !s.sortieNo.toLowerCase().includes(filters.sortieNo.toLowerCase())) return false;
      return true;
    });
  }, [sorties, filters]);
}

function isIncomplete(s: Sortie, photos: { sortieId: string }[], kmlRoutes: { sortieId: string }[], confirmations: { sortieId: string }[], flightReviews: { sortieId: string }[]) {
  const has = (arr: { sortieId: string }[]) => arr.some((x) => x.sortieId === s.id);
  return !has(photos) || !has(kmlRoutes) || !has(confirmations) || !has(flightReviews);
}

export default function ExportPage() {
  const navigate = useNavigate();
  const store = useAppStore();
  const { filters, photos, kmlRoutes, confirmations, flightReviews } = store;
  const filtered = useFilteredSorties();
  const [format, setFormat] = useState<"json" | "html">("json");
  const [warning, setWarning] = useState<Sortie[] | null>(null);

  const completeCount = useMemo(
    () => filtered.filter((s) => !isIncomplete(s, photos, kmlRoutes, confirmations, flightReviews)).length,
    [filtered, photos, kmlRoutes, confirmations, flightReviews],
  );

  const activeCount = filters.status.length + filters.anomalyTags.length +
    (filters.dateRange.start || filters.dateRange.end ? 1 : 0) +
    (filters.batteryId ? 1 : 0) + (filters.sortieNo ? 1 : 0);

  const toggleFilter = <K extends "status" | "anomalyTags">(key: K, value: K extends "status" ? SortieStatus : AnomalyTag) => {
    const current = filters[key] as (SortieStatus | AnomalyTag)[];
    const next = current.includes(value as never) ? current.filter((v) => v !== value) : [...current, value];
    store.setFilters({ [key]: next });
  };

  const doExport = () => {
    const incomplete = filtered.filter((s) => isIncomplete(s, photos, kmlRoutes, confirmations, flightReviews));
    if (incomplete.length) { setWarning(incomplete); return; }
    runExport();
  };

  const runExport = () => {
    setWarning(null);
    if (format === "json") exportJson(); else exportHtml();
  };

  const exportJson = () => {
    const data = filtered.map((s) => ({
      sortie: s,
      photos: photos.filter((p) => p.sortieId === s.id),
      kmlRoutes: kmlRoutes.filter((k) => k.sortieId === s.id),
      confirmations: confirmations.filter((c) => c.sortieId === s.id),
      flightReviews: flightReviews.filter((r) => r.sortieId === s.id),
    }));
    download(JSON.stringify(data, null, 2), "inspection-report.json", "application/json");
  };

  const exportHtml = () => {
    const rows = filtered.map((s) => {
      const sp = photos.filter((p) => p.sortieId === s.id);
      const sk = kmlRoutes.filter((k) => k.sortieId === s.id);
      const sc = confirmations.filter((c) => c.sortieId === s.id);
      const sr = flightReviews.filter((r) => r.sortieId === s.id);
      return `<tr><td>${s.sortieNo}</td><td>${s.batteryId}</td><td>${s.status}</td><td>${new Date(s.timestamp).toLocaleString()}</td><td>${sp.map((p) => `<img src="${p.thumbnailUrl}" style="max-width:80px"/>`).join("")}</td><td>${sk.length} routes</td><td>${sc.length} records</td><td>${sr.length} reviews</td></tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>换电巡检报告</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;text-align:left}img{border-radius:4px}</style></head><body><h1>换电巡检报告</h1><p>生成时间: ${new Date().toLocaleString()}</p><table><tr><th>架次</th><th>电池</th><th>状态</th><th>时间</th><th>照片</th><th>KML</th><th>确认</th><th>复核</th></tr>${rows}</table></body></html>`;
    download(html, "inspection-report.html", "text/html");
  };

  const download = (content: string, name: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex gap-6 p-6 h-full">
      <aside className="w-80 shrink-0 bg-[#16213e] rounded-lg sticky top-6 self-start">
        <div className="p-4 border-b border-white/10 flex items-center gap-2 text-gray-200">
          <Filter size={16} /> 筛选条件 {activeCount > 0 && <span className="ml-auto bg-amber-400 text-[#1a1a2e] text-xs px-1.5 rounded-full">{activeCount}</span>}
        </div>
        <section className="p-4 border-b border-white/10">
          <h3 className="text-sm text-gray-400 mb-2">状态筛选</h3>
          {STATUS_OPTIONS.map(({ value, label, color }) => (
            <label key={value} className="flex items-center gap-2 py-1 text-sm text-gray-200 cursor-pointer">
              <input type="checkbox" className="accent-amber-400" checked={filters.status.includes(value)} onChange={() => toggleFilter("status", value)} />
              <span className={`w-2 h-2 rounded-full ${color}`} />{label}
            </label>
          ))}
        </section>
        <section className="p-4 border-b border-white/10">
          <h3 className="text-sm text-gray-400 mb-2">异常类型筛选</h3>
          {ANOMALY_OPTIONS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 py-1 text-sm text-gray-200 cursor-pointer">
              <input type="checkbox" className="accent-amber-400" checked={filters.anomalyTags.includes(value)} onChange={() => toggleFilter("anomalyTags", value)} />
              {label}
            </label>
          ))}
        </section>
        <section className="p-4 border-b border-white/10">
          <h3 className="text-sm text-gray-400 mb-2">日期范围</h3>
          <input type="date" className="w-full bg-[#0f0f23] border border-white/10 rounded px-3 py-1.5 text-sm text-gray-200 mb-2" value={filters.dateRange.start ? new Date(filters.dateRange.start).toISOString().slice(0, 10) : ""} onChange={(e) => store.setFilters({ dateRange: { ...filters.dateRange, start: e.target.value ? new Date(e.target.value).getTime() : null } })} />
          <input type="date" className="w-full bg-[#0f0f23] border border-white/10 rounded px-3 py-1.5 text-sm text-gray-200" value={filters.dateRange.end ? new Date(filters.dateRange.end).toISOString().slice(0, 10) : ""} onChange={(e) => store.setFilters({ dateRange: { ...filters.dateRange, end: e.target.value ? new Date(e.target.value).getTime() : null } })} />
        </section>
        <section className="p-4 border-b border-white/10">
          <h3 className="text-sm text-gray-400 mb-2 flex items-center gap-1"><Search size={12} /> 编号搜索</h3>
          <input type="text" placeholder="架次编号" className="w-full bg-[#0f0f23] border border-white/10 rounded px-3 py-1.5 text-sm text-gray-200 mb-2" value={filters.sortieNo} onChange={(e) => store.setFilters({ sortieNo: e.target.value })} />
          <input type="text" placeholder="电池编号" className="w-full bg-[#0f0f23] border border-white/10 rounded px-3 py-1.5 text-sm text-gray-200" value={filters.batteryId} onChange={(e) => store.setFilters({ batteryId: e.target.value })} />
        </section>
        <div className="p-4">
          <button onClick={() => store.resetFilters()} className="w-full flex items-center justify-center gap-2 border border-white/20 text-gray-300 rounded py-2 text-sm hover:bg-white/5"><RotateCcw size={14} /> 重置筛选</button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-gray-200 text-sm">筛选结果: {filtered.length} 条</span>
          <span className="text-gray-400 text-sm">{completeCount}/{filtered.length} 条证据完整</span>
          <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 rounded-full" style={{ width: filtered.length ? `${(completeCount / filtered.length) * 100}%` : "0%" }} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select value={format} onChange={(e) => setFormat(e.target.value as "json" | "html")} className="bg-[#0f0f23] border border-white/10 rounded px-2 py-1.5 text-sm text-gray-200">
              <option value="json">JSON</option>
              <option value="html">HTML</option>
            </select>
            <button onClick={doExport} className="bg-amber-400 text-[#1a1a2e] font-medium px-4 py-1.5 rounded text-sm flex items-center gap-1.5 hover:bg-amber-300">
              {format === "json" ? <FileJson size={14} /> : <FileText size={14} />}<Download size={14} /> 导出报告
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-gray-500 text-center py-20">无匹配结果，请调整筛选条件</div>
        ) : (
          <div className="overflow-auto rounded border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-[#16213e] text-gray-400">
                <tr>
                  <th className="text-left px-3 py-2">架次编号</th>
                  <th className="text-left px-3 py-2">电池编号</th>
                  <th className="text-left px-3 py-2">状态</th>
                  <th className="text-left px-3 py-2">时间</th>
                  <th className="text-left px-3 py-2">异常标签</th>
                  <th className="text-left px-3 py-2">证据完整性</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const inc = isIncomplete(s, photos, kmlRoutes, confirmations, flightReviews);
                  return (
                    <tr key={s.id} onClick={() => navigate(`/evidence/${s.id}`)} className={`border-t border-white/5 cursor-pointer hover:bg-white/5 ${inc ? "bg-red-900/20" : ""}`}>
                      <td className="px-3 py-2 text-gray-200">{s.sortieNo}</td>
                      <td className="px-3 py-2 text-gray-300">{s.batteryId}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${s.status === "normal" ? "bg-green-900/40 text-green-400" : s.status === "pending" ? "bg-yellow-900/40 text-yellow-400" : "bg-red-900/40 text-red-400"}`}>{s.status === "normal" ? "正常" : s.status === "pending" ? "待确认" : "异常"}</span></td>
                      <td className="px-3 py-2 text-gray-400">{new Date(s.timestamp).toLocaleString()}</td>
                      <td className="px-3 py-2 text-gray-400">{s.anomalyTags.join(", ") || "-"}</td>
                      <td className="px-3 py-2"><EvidenceIcons sortieId={s.id} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {warning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#16213e] rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-gray-200 font-medium flex items-center gap-2 mb-4"><AlertTriangle className="text-amber-400" size={18} /> 证据不完整警告</h3>
            <p className="text-gray-400 text-sm mb-3">以下条目证据不完整，导出报告可能缺少关键依据：</p>
            <ul className="text-sm text-red-300 mb-4 max-h-40 overflow-auto space-y-1">
              {warning.map((s) => <li key={s.id}>• {s.sortieNo}</li>)}
            </ul>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setWarning(null)} className="border border-white/20 text-gray-300 px-4 py-1.5 rounded text-sm hover:bg-white/5">返回补充</button>
              <button onClick={runExport} className="bg-amber-400 text-[#1a1a2e] font-medium px-4 py-1.5 rounded text-sm hover:bg-amber-300">继续导出</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
