import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Printer, FileSpreadsheet, AlertTriangle, MapPin, Eye, RotateCcw, Search, X } from "lucide-react";
import { useReviewStore } from "@/store/useReviewStore";
import StatusBadge from "@/components/StatusBadge";
import type { MaterialItem, Anomaly, AnomalyStatus, AnomalySeverity, AnomalyType, SourceRowType } from "@/types";
import { cn } from "@/lib/utils";
import { OPERATORS } from "@/data/mockData";

const DATA_TYPES = ["材料送审表", "异常记录", "后补备注"] as const;
const ANOMALY_STATUSES: AnomalyStatus[] = ["待确认", "已确认正常", "已确认异常"];
const ANOMALY_TYPES: AnomalyType[] = ["碰撞", "变更未同步", "坡度异常", "材料不符"];
const SEVERITIES: ("全部" | AnomalySeverity)[] = ["全部", "一般", "严重"];
const ROW_TYPES: SourceRowType[] = ["标准行", "后补备注行"];
const ZONES = ["A", "B", "C", "D"] as const;

interface FilterState {
  dataTypes: string[];
  anomalyStatuses: string[];
  anomalyTypes: string[];
  severity: "全部" | AnomalySeverity;
  rowTypes: string[];
  zones: string[];
  dateStart: string;
  dateEnd: string;
  operator: string;
  keyword: string;
}

const DEFAULT_FILTERS: FilterState = {
  dataTypes: ["材料送审表", "异常记录", "后补备注"],
  anomalyStatuses: [], anomalyTypes: [], severity: "全部",
  rowTypes: ["标准行", "后补备注行"], zones: [],
  dateStart: "", dateEnd: "", operator: "全部", keyword: "",
};

interface MergedRow {
  id: string;
  material: MaterialItem | null;
  anomaly: Anomaly | null;
  code: string; name: string; spec: string; batch: string; supplier: string; qty: string;
  rowType: SourceRowType; materialStatus: string;
  anomalyType?: AnomalyType; severity?: AnomalySeverity; anomalyStatus?: AnomalyStatus;
  zone: string; confirmedBy?: string; confirmedAt?: string; createdAt: string;
  remark: string; changeNotesSummary: string; sortWeight: number;
  isAnomalyRow: boolean; isNoteRow: boolean;
}

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm no-print">
      <div className="bg-white rounded-lg shadow-xl w-[520px] max-w-[92vw] border border-slate-200 overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
          <h3 className="font-display font-semibold text-slate-800 text-[15px]">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export default function ExportCenter() {
  const navigate = useNavigate();
  const store = useReviewStore();
  const { materials, drawingPoints, anomalies, supplementNotes, reviewActions, setHighlightedPoint, setSelectedAnomaly } = store;

  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [detailModal, setDetailModal] = useState<{ open: boolean; row: MergedRow | null }>({ open: false, row: null });

  const toggleArr = <T extends string>(arr: T[], v: T): T[] => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  const setDraft = (patch: Partial<FilterState>) => setDraftFilters(prev => ({ ...prev, ...patch }));

  const mergedRows = useMemo<MergedRow[]>(() => {
    const anomalyByMat = new Map<string, Anomaly[]>();
    anomalies.forEach(a => { const l = anomalyByMat.get(a.materialItemId) ?? []; l.push(a); anomalyByMat.set(a.materialItemId, l); });
    const pointByMat = new Map<string, string>();
    drawingPoints.forEach(p => pointByMat.set(p.materialItemId, p.zone));
    const notesByMat = new Map<string, string[]>();
    supplementNotes.forEach(sn => { const l = notesByMat.get(sn.materialItemId) ?? []; l.push(`【${sn.author}】${sn.content}`); notesByMat.set(sn.materialItemId, l); });
    const actionsByTarget = new Map<string, string[]>();
    reviewActions.forEach(ra => {
      const before = JSON.stringify(ra.before).replace(/[{}"]/g, "");
      const after = JSON.stringify(ra.after).replace(/[{}"]/g, "");
      const line = `${ra.type} ${ra.timestamp} ${ra.operator} 变更：${before || "—"}→${after || "—"}`;
      const l = actionsByTarget.get(ra.targetId) ?? []; l.push(line); actionsByTarget.set(ra.targetId, l);
    });

    return materials.map(mat => {
      const matAnomalies = anomalyByMat.get(mat.id) ?? [];
      const zone = pointByMat.get(mat.id) ?? "—";
      const notes = notesByMat.get(mat.id) ?? [];
      const actions = actionsByTarget.get(mat.id) ?? [];
      const primaryAnomaly = matAnomalies.length > 0
        ? matAnomalies.sort((a, b) => (b.severity === "严重" ? 1 : 0) - (a.severity === "严重" ? 1 : 0))[0]
        : null;
      const isNoteRow = mat.sourceRowType === "后补备注行";
      const isAnomalyRow = primaryAnomaly !== null && (primaryAnomaly.status === "待确认" || primaryAnomaly.status === "已确认异常");
      const weight = primaryAnomaly && (primaryAnomaly.status === "待确认" || primaryAnomaly.severity === "严重") ? 3 : isNoteRow ? 2 : 1;
      const remarkParts = [mat.remark, ...matAnomalies.map(a => `⚠ ${a.description}`)].filter(Boolean);

      return {
        id: `mat-${mat.id}`, material: mat, anomaly: primaryAnomaly,
        code: mat.code, name: mat.name, spec: mat.spec, batch: mat.batch, supplier: mat.supplier, qty: mat.qty,
        rowType: mat.sourceRowType, materialStatus: mat.status,
        anomalyType: primaryAnomaly?.type, severity: primaryAnomaly?.severity, anomalyStatus: primaryAnomaly?.status,
        zone, confirmedBy: primaryAnomaly?.confirmedBy, confirmedAt: primaryAnomaly?.confirmedAt,
        createdAt: mat.createdAt, remark: remarkParts.join("\n"),
        changeNotesSummary: [...notes, ...actions].join("\n"),
        sortWeight: weight, isAnomalyRow, isNoteRow,
      };
    }).sort((a, b) => b.sortWeight !== a.sortWeight ? b.sortWeight - a.sortWeight : b.createdAt.localeCompare(a.createdAt));
  }, [materials, anomalies, drawingPoints, supplementNotes, reviewActions]);

  const filteredRows = useMemo(() => {
    const f = appliedFilters;
    return mergedRows.filter(row => {
      if (f.dataTypes.length === 0) return false;
      if (!f.dataTypes.includes("材料送审表") && !row.isNoteRow && row.anomaly === null) return false;
      if (!f.dataTypes.includes("后补备注") && row.isNoteRow) return false;
      if (f.anomalyStatuses.length > 0 && (!row.anomalyStatus || !f.anomalyStatuses.includes(row.anomalyStatus))) return false;
      if (f.anomalyTypes.length > 0 && (!row.anomalyType || !f.anomalyTypes.includes(row.anomalyType))) return false;
      if (f.severity !== "全部" && row.severity !== f.severity) return false;
      if (f.rowTypes.length > 0 && !f.rowTypes.includes(row.rowType)) return false;
      if (f.zones.length > 0 && (row.zone === "—" || !f.zones.includes(row.zone))) return false;
      if (f.dateStart && row.createdAt < f.dateStart) return false;
      if (f.dateEnd && row.createdAt > f.dateEnd) return false;
      if (f.operator !== "全部" && (!row.confirmedBy || row.confirmedBy !== f.operator)) return false;
      if (f.keyword.trim()) {
        const kw = f.keyword.trim().toLowerCase();
        const hs = [row.code, row.name, row.spec, row.batch, row.supplier, row.remark, row.anomaly?.description].join(" ").toLowerCase();
        if (!hs.includes(kw)) return false;
      }
      return true;
    });
  }, [mergedRows, appliedFilters]);

  const stats = useMemo(() => ({
    total: filteredRows.length,
    standard: filteredRows.filter(r => r.rowType === "标准行").length,
    note: filteredRows.filter(r => r.rowType === "后补备注行").length,
    anomaly: filteredRows.filter(r => r.anomaly !== null).length,
  }), [filteredRows]);

  const handleGoDrawing = (row: MergedRow) => {
    const point = drawingPoints.find(p => p.materialItemId === row.material?.id);
    if (point) setHighlightedPoint(point.id);
    if (row.anomaly) setSelectedAnomaly(row.anomaly.id);
    navigate("/drawing-review");
  };

  const handleExportCSV = () => {
    const headers = ["异常标记", "变更备注", "编号", "名称", "规格", "批次", "供应商", "数量", "行类型", "材料状态", "异常类型", "严重程度", "异常状态", "分区", "确认人", "确认时间", "录入日期", "来源备注"];
    const esc = (v: string) => `"${v.replace(/"/g, '""').replace(/\n/g, " ")}"`;
    const lines = [headers.join(",")];
    filteredRows.forEach(row => {
      const mark = row.anomaly ? `⚠️ [${row.anomalyType ?? ""}] [${row.severity ?? ""}]` : "";
      lines.push([
        esc(mark), esc(row.changeNotesSummary), esc(row.code), esc(row.name), esc(row.spec),
        esc(row.batch), esc(row.supplier), esc(row.qty), esc(row.rowType), esc(row.materialStatus),
        esc(row.anomalyType ?? ""), esc(row.severity ?? ""), esc(row.anomalyStatus ?? ""), esc(row.zone),
        esc(row.confirmedBy ?? ""), esc(row.confirmedAt ?? ""), esc(row.createdAt), esc(row.remark),
      ].join(","));
    });
    const d = new Date(), pad = (n: number) => n.toString().padStart(2, "0");
    const filename = `屋面排水复核_异常痕迹_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const Checkbox = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-slate-900 py-0.5">
      <input type="checkbox" checked={checked} onChange={onChange} className="rounded w-4 h-4 border-slate-300 text-brand-700 focus:ring-brand-500" />
      {label}
    </label>
  );

  const FG = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="pb-4 mb-4 border-b border-slate-200 last:border-b-0 last:mb-0 last:pb-0">
      <h4 className="text-xs font-semibold text-slate-600 mb-2.5 tracking-wide">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );

  const inputCls = "w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white";

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-5 no-print">
          <h1 className="text-2xl font-display font-bold text-slate-800">筛选与导出中心</h1>
          <p className="text-sm text-slate-500 mt-1">异常筛选 · 痕迹保留 · 导出CSV/打印</p>
        </header>

        <div className="flex gap-5">
          <aside className="w-1/4 no-print flex-shrink-0">
            <div className="card p-4 sticky top-4">
              <div className="max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
                <FG title="数据类型">
                  {DATA_TYPES.map(dt => <Checkbox key={dt} label={dt} checked={draftFilters.dataTypes.includes(dt)} onChange={() => setDraft({ dataTypes: toggleArr(draftFilters.dataTypes, dt) })} />)}
                </FG>
                <FG title="异常状态">
                  {ANOMALY_STATUSES.map(s => <Checkbox key={s} label={s} checked={draftFilters.anomalyStatuses.includes(s)} onChange={() => setDraft({ anomalyStatuses: toggleArr(draftFilters.anomalyStatuses, s) })} />)}
                </FG>
                <FG title="异常类型">
                  {ANOMALY_TYPES.map(t => <Checkbox key={t} label={t} checked={draftFilters.anomalyTypes.includes(t)} onChange={() => setDraft({ anomalyTypes: toggleArr(draftFilters.anomalyTypes, t) })} />)}
                </FG>
                <FG title="严重程度">
                  <div className="flex flex-wrap gap-2">
                    {SEVERITIES.map(s => (
                      <label key={s} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                        <input type="radio" name="severity" checked={draftFilters.severity === s} onChange={() => setDraft({ severity: s })} className="text-brand-700 focus:ring-brand-500" />
                        {s}
                      </label>
                    ))}
                  </div>
                </FG>
                <FG title="行类型">
                  {ROW_TYPES.map(rt => <Checkbox key={rt} label={rt} checked={draftFilters.rowTypes.includes(rt)} onChange={() => setDraft({ rowTypes: toggleArr(draftFilters.rowTypes, rt) })} />)}
                </FG>
                <FG title="关联分区">
                  <div className="grid grid-cols-2 gap-1">
                    {ZONES.map(z => <Checkbox key={z} label={`${z}区`} checked={draftFilters.zones.includes(z)} onChange={() => setDraft({ zones: toggleArr(draftFilters.zones, z) })} />)}
                  </div>
                </FG>
                <FG title="录入日期范围">
                  <div className="space-y-2">
                    <input type="date" value={draftFilters.dateStart} onChange={e => setDraft({ dateStart: e.target.value })} className={inputCls} />
                    <input type="date" value={draftFilters.dateEnd} onChange={e => setDraft({ dateEnd: e.target.value })} className={inputCls} />
                  </div>
                </FG>
                <FG title="负责人">
                  <select value={draftFilters.operator} onChange={e => setDraft({ operator: e.target.value })} className={inputCls}>
                    <option value="全部">全部</option>
                    {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                </FG>
                <FG title="关键词搜索">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input type="text" placeholder="搜索编号/名称/备注/异常描述..." value={draftFilters.keyword} onChange={e => setDraft({ keyword: e.target.value })} className={cn(inputCls, "pl-8")} />
                  </div>
                </FG>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 flex gap-2">
                <button onClick={() => setDraftFilters(DEFAULT_FILTERS)} className="btn flex-1 justify-center"><RotateCcw className="w-4 h-4" />重置筛选</button>
                <button onClick={() => setAppliedFilters(draftFilters)} className="btn btn-primary flex-1 justify-center">应用筛选</button>
              </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0">
            <div className="card">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center gap-3 justify-between no-print">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">共匹配</span>
                    <span className="font-bold text-lg text-brand-700">{stats.total}</span>
                    <span className="text-slate-500">条</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-blue-700 font-semibold">{stats.standard}</span>标准行
                    <span className="text-amber-700 font-semibold ml-2">{stats.note}</span>后补备注行
                    <span className="text-red-700 font-semibold ml-2">{stats.anomaly}</span>异常记录
                  </div>
                  {stats.anomaly > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium border border-red-200 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />{stats.anomaly} 个异常待处理
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleExportCSV} className="btn btn-success"><Download className="w-4 h-4" />导出 CSV</button>
                  <button onClick={() => window.print()} className="btn"><Printer className="w-4 h-4" />打印预览</button>
                  <button onClick={() => navigate("/material-review")} className="btn"><FileSpreadsheet className="w-4 h-4" />返回送审表</button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="px-3 py-3 text-left font-medium w-20">异常</th>
                      <th className="px-3 py-3 text-left font-medium w-48">变更备注</th>
                      <th className="px-3 py-3 text-left font-medium w-24">编号</th>
                      <th className="px-3 py-3 text-left font-medium">名称</th>
                      <th className="px-3 py-3 text-left font-medium w-28">规格</th>
                      <th className="px-3 py-3 text-left font-medium w-24">批次</th>
                      <th className="px-3 py-3 text-left font-medium w-28">供应商</th>
                      <th className="px-3 py-3 text-left font-medium w-24">行类型</th>
                      <th className="px-3 py-3 text-left font-medium w-24">状态</th>
                      <th className="px-3 py-3 text-left font-medium w-16">分区</th>
                      <th className="px-3 py-3 text-left font-medium w-36">日期</th>
                      <th className="px-3 py-3 text-left font-medium w-48">备注</th>
                      <th className="px-3 py-3 text-left font-medium w-36 no-print">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(row => (
                      <tr key={row.id} className={cn("border-b border-slate-100 transition-colors hover:bg-slate-50", row.isAnomalyRow && "row-anomaly", row.isNoteRow && "row-note", row.anomalyStatus === "已确认正常" && "bg-emerald-50/40")}>
                        <td className="px-3 py-3">
                          {row.anomaly ? (
                            <div className="flex flex-col gap-1">
                              <AlertTriangle className="w-5 h-5 text-red-600" />
                              <span className="badge badge-danger w-fit">{row.anomalyType}</span>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600 max-w-[12rem]">
                          <div className="whitespace-pre-wrap line-clamp-3">{row.changeNotesSummary || "—"}</div>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-600">{row.code}</td>
                        <td className="px-3 py-3 font-medium text-slate-800">{row.name}</td>
                        <td className="px-3 py-3 text-slate-600">{row.spec}</td>
                        <td className="px-3 py-3 text-slate-600">{row.batch}</td>
                        <td className="px-3 py-3 text-slate-600">{row.supplier}</td>
                        <td className="px-3 py-3">
                          {row.rowType === "标准行" ? (
                            <span className="badge badge-info">标准行</span>
                          ) : (
                            <span className="badge badge-warn relative">
                              后补备注行
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white text-[9px] flex items-center justify-center rounded-sm rotate-12 shadow-sm">📌</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {row.anomaly ? (
                            <div className="flex flex-col gap-1">
                              <StatusBadge type="material" value={row.materialStatus} />
                              <StatusBadge type="anomaly" value={row.anomalyStatus!} />
                              {row.severity && <StatusBadge type="severity" value={row.severity} />}
                            </div>
                          ) : <StatusBadge type="material" value={row.materialStatus} />}
                        </td>
                        <td className="px-3 py-3 text-slate-600 font-medium">{row.zone === "—" ? "—" : `${row.zone}区`}</td>
                        <td className="px-3 py-3 text-slate-500 text-xs">
                          <div>{row.createdAt}</div>
                          {row.confirmedAt && <div className="text-emerald-600 mt-0.5">✓ {row.confirmedAt}</div>}
                        </td>
                        <td className="px-3 py-3 text-slate-600 text-xs max-w-[12rem]">
                          <div className="whitespace-pre-wrap line-clamp-3">{row.remark || "—"}</div>
                        </td>
                        <td className="px-3 py-3 no-print">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={() => handleGoDrawing(row)} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded hover:bg-brand-100 transition">
                              <MapPin className="w-3 h-3" />定位图纸
                            </button>
                            <button onClick={() => setDetailModal({ open: true, row })} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition">
                              <Eye className="w-3 h-3" />查看详情
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr><td colSpan={13} className="px-3 py-16 text-center text-slate-400">暂无匹配的数据，请调整筛选条件</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center gap-6 text-sm flex-wrap no-print">
                <div className="flex items-center gap-2 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300" />异常行</div>
                <div className="flex items-center gap-2 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" />后补备注行</div>
                <div className="flex items-center gap-2 text-xs text-slate-500"><span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" />已确认正常</div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal open={detailModal.open} title="详情信息" onClose={() => setDetailModal({ open: false, row: null })}>
        {detailModal.row && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-slate-500 text-xs">编号：</span><span className="font-mono text-slate-800">{detailModal.row.code}</span></div>
              <div><span className="text-slate-500 text-xs">名称：</span><span className="font-medium text-slate-800">{detailModal.row.name}</span></div>
              <div><span className="text-slate-500 text-xs">规格：</span><span className="text-slate-700">{detailModal.row.spec}</span></div>
              <div><span className="text-slate-500 text-xs">批次：</span><span className="text-slate-700">{detailModal.row.batch}</span></div>
              <div><span className="text-slate-500 text-xs">供应商：</span><span className="text-slate-700">{detailModal.row.supplier}</span></div>
              <div><span className="text-slate-500 text-xs">分区：</span><span className="text-slate-700">{detailModal.row.zone}</span></div>
              <div><span className="text-slate-500 text-xs">状态：</span><StatusBadge type="material" value={detailModal.row.materialStatus} /></div>
              <div><span className="text-slate-500 text-xs">录入日期：</span><span className="text-slate-700">{detailModal.row.createdAt}</span></div>
            </div>
            {detailModal.row.anomaly && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md space-y-2">
                <div className="font-semibold text-red-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />异常信息</div>
                <div className="text-xs text-red-700">
                  <div>类型：{detailModal.row.anomalyType} / 程度：{detailModal.row.severity} / 状态：{detailModal.row.anomalyStatus}</div>
                  {detailModal.row.confirmedBy && <div>确认人：{detailModal.row.confirmedBy} @ {detailModal.row.confirmedAt}</div>}
                  <div className="mt-1 whitespace-pre-wrap">描述：{detailModal.row.anomaly.description}</div>
                </div>
              </div>
            )}
            <div>
              <div className="text-slate-500 text-xs mb-1">备注</div>
              <div className="p-2.5 bg-slate-50 rounded text-slate-700 whitespace-pre-wrap text-xs">{detailModal.row.remark || "—"}</div>
            </div>
            {detailModal.row.changeNotesSummary && (
              <div>
                <div className="text-slate-500 text-xs mb-1">变更备注（异常痕迹）</div>
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-slate-700 whitespace-pre-wrap text-xs">{detailModal.row.changeNotesSummary}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
