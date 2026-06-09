import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ArrowRightToLine,
  FileText,
  MapPin,
  CheckCircle,
  AlertTriangle,
  MessageSquarePlus,
  X,
  Pin,
} from "lucide-react";
import { useReviewStore } from "@/store/useReviewStore";
import type { MaterialStatus, SourceRowType, MaterialItem } from "@/types";
import { cn } from "@/lib/utils";
import { OPERATORS } from "@/data/mockData";

type StatusTab = "全部" | "已复核" | "待复核" | "异常";
const STATUS_TABS: StatusTab[] = ["全部", "已复核", "待复核", "异常"];

function StatusBadge({ status }: { status: MaterialStatus }) {
  const map = { 已复核: "badge-success", 待复核: "badge-info", 异常: "badge-danger" } as const;
  const iconMap = { 已复核: <CheckCircle className="w-3 h-3 mr-1" />, 待复核: null, 异常: <AlertTriangle className="w-3 h-3 mr-1" /> };
  return <span className={cn("badge", map[status])}>{iconMap[status]}{status}</span>;
}

function RowTypeBadge({ type }: { type: SourceRowType }) {
  if (type === "标准行") return <span className="badge badge-info">标准行</span>;
  return (
    <span className="badge badge-warn relative">
      后补备注行
      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white text-[9px] flex items-center justify-center rounded-sm rotate-12 shadow-sm">📌</span>
    </span>
  );
}

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-[460px] max-w-[92vw] border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
          <h3 className="font-display font-semibold text-slate-800 text-[15px]">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function MaterialReview() {
  const navigate = useNavigate();
  const store = useReviewStore();
  const { materials, drawingPoints, anomalies, currentOperator, setHighlightedPoint, setSelectedAnomaly, updateMaterialStatus, addSupplementNote, addMaterialItem } = store;

  const [statusTab, setStatusTab] = useState<StatusTab>("全部");
  const [keyword, setKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [noteModal, setNoteModal] = useState<{ open: boolean; materialId: string | null }>({ open: false, materialId: null });
  const [noteContent, setNoteContent] = useState("");
  const [noteAuthor, setNoteAuthor] = useState(currentOperator);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("后补备注");
  const [addCode, setAddCode] = useState("");
  const [addRemark, setAddRemark] = useState("");

  const filtered = useMemo(() => {
    let list = materials;
    if (statusTab !== "全部") list = list.filter((m) => m.status === statusTab);
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter((m) => m.code.toLowerCase().includes(kw) || m.name.toLowerCase().includes(kw) || m.supplier.toLowerCase().includes(kw) || m.remark.toLowerCase().includes(kw));
    }
    return list;
  }, [materials, statusTab, keyword]);

  const stats = useMemo(() => ({
    total: materials.length,
    standard: materials.filter((m) => m.sourceRowType === "标准行").length,
    note: materials.filter((m) => m.sourceRowType === "后补备注行").length,
    anomaly: materials.filter((m) => m.status === "异常").length,
    reviewed: materials.filter((m) => m.status === "已复核").length,
    pending: materials.filter((m) => m.status === "待复核").length,
  }), [materials]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const handleGoDrawing = (item: MaterialItem) => {
    const point = drawingPoints.find((p) => p.materialItemId === item.id);
    if (point) setHighlightedPoint(point.id);
    const anomaly = anomalies.find((a) => a.materialItemId === item.id);
    if (anomaly) setSelectedAnomaly(anomaly.id);
    navigate("/drawing-review");
  };

  const handleSubmitNote = () => {
    if (!noteModal.materialId || !noteContent.trim()) return;
    addSupplementNote(noteModal.materialId, noteContent.trim(), noteAuthor);
    setNoteModal({ open: false, materialId: null });
    setNoteContent("");
    setNoteAuthor(currentOperator);
  };

  const handleSubmitAdd = () => {
    if (!addRemark.trim()) return;
    addMaterialItem({
      code: addCode.trim() || `BZ-${Date.now().toString().slice(-4)}`,
      name: addName.trim() || "后补备注",
      spec: "—", batch: "—", supplier: "—", qty: "—",
      status: "待复核", sourceRowType: "后补备注行",
      remark: addRemark.trim(),
    });
    setAddModalOpen(false);
    setAddName("后补备注");
    setAddCode("");
    setAddRemark("");
  };

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500";

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-5">
          <h1 className="text-2xl font-display font-bold text-slate-800 flex items-center gap-2">
            材料送审表<span className="text-brand-600 text-xl">·</span><span className="text-brand-700">屋面排水</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">结构工程师老叶用本页作为复核起点</p>
        </header>

        <div className="card">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-slate-100 rounded-md p-0.5">
                {STATUS_TABS.map((tab) => (
                  <button key={tab} onClick={() => setStatusTab(tab)}
                    className={cn("px-3.5 py-1.5 text-sm font-medium rounded transition-all",
                      statusTab === tab ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="搜索编号、名称、供应商、备注..." value={keyword} onChange={(e) => setKeyword(e.target.value)}
                  className={cn(inputCls, "pl-9 w-72")} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/drawing-review")} className="btn btn-primary">
                <ArrowRightToLine className="w-4 h-4" />跳转到图纸复核
              </button>
              <button onClick={() => setAddModalOpen(true)} className="btn btn-warn">
                <FileText className="w-4 h-4" />新增后补备注
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-3 w-10 text-center font-medium"><input type="checkbox" className="rounded" /></th>
                  <th className="px-3 py-3 text-left font-medium w-24">编号</th>
                  <th className="px-3 py-3 text-left font-medium">名称</th>
                  <th className="px-3 py-3 text-left font-medium w-28">规格</th>
                  <th className="px-3 py-3 text-left font-medium w-24">批次</th>
                  <th className="px-3 py-3 text-left font-medium w-28">供应商</th>
                  <th className="px-3 py-3 text-left font-medium w-20">数量</th>
                  <th className="px-3 py-3 text-left font-medium w-24">状态</th>
                  <th className="px-3 py-3 text-left font-medium w-28">行类型</th>
                  <th className="px-3 py-3 text-left font-medium w-28">录入日期</th>
                  <th className="px-3 py-3 text-left font-medium">备注</th>
                  <th className="px-3 py-3 text-left font-medium w-52">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isNote = item.sourceRowType === "后补备注行";
                  return (
                    <tr key={item.id} className={cn("border-b border-slate-100 transition-colors hover:bg-slate-50", item.status === "异常" && "row-anomaly", isNote && "row-note")}>
                      <td className="px-3 py-3 text-center">
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded" />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">{item.code}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{item.name}</td>
                      <td className="px-3 py-3 text-slate-600">{item.spec}</td>
                      <td className="px-3 py-3 text-slate-600">{item.batch}</td>
                      <td className="px-3 py-3 text-slate-600">{item.supplier}</td>
                      <td className="px-3 py-3 text-slate-600">{item.qty}</td>
                      <td className="px-3 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-3 py-3 relative"><RowTypeBadge type={item.sourceRowType} /></td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{item.createdAt}</td>
                      <td className={cn("px-3 py-3 text-slate-600 text-xs max-w-xs", isNote && "whitespace-pre-wrap")}>{item.remark}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => handleGoDrawing(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded hover:bg-brand-100 transition">
                            <MapPin className="w-3 h-3" />查看图纸位置
                          </button>
                          <div className="flex items-center overflow-hidden rounded border border-slate-200">
                            <button onClick={() => updateMaterialStatus(item.id, "已复核")}
                              className={cn("px-2 py-1 text-xs transition", item.status === "已复核" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50")}>
                              已复核
                            </button>
                            <span className="w-px h-4 bg-slate-200" />
                            <button onClick={() => updateMaterialStatus(item.id, "异常")}
                              className={cn("px-2 py-1 text-xs transition", item.status === "异常" ? "bg-red-600 text-white" : "text-red-700 hover:bg-red-50")}>
                              异常
                            </button>
                          </div>
                          <button onClick={() => setNoteModal({ open: true, materialId: item.id })}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition">
                            <MessageSquarePlus className="w-3 h-3" />补录备注
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={12} className="px-3 py-16 text-center text-slate-400">暂无匹配的数据</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">共</span>
              <span className="font-semibold text-slate-800">{stats.total}</span>
              <span className="text-slate-500">条</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 text-xs">标准行 <b className="text-blue-700">{stats.standard}</b> / 后补 <b className="text-amber-700">{stats.note}</b></span>
            </div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-slate-500 text-xs">异常</span><b className="text-red-700">{stats.anomaly}</b></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-slate-500 text-xs">已复核</span><b className="text-emerald-700">{stats.reviewed}</b></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-slate-500 text-xs">待复核</span><b className="text-blue-700">{stats.pending}</b></div>
          </div>
        </div>
      </div>

      <Modal open={noteModal.open} title="补录备注" onClose={() => setNoteModal({ open: false, materialId: null })}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">备注内容</label>
            <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} rows={5} placeholder="请输入需要补充的说明..."
              className={cn(inputCls, "resize-none")} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">作者</label>
            <select value={noteAuthor} onChange={(e) => setNoteAuthor(e.target.value)} className={cn(inputCls, "bg-white")}>
              {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setNoteModal({ open: false, materialId: null })} className="btn">取消</button>
            <button onClick={handleSubmitNote} disabled={!noteContent.trim()} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">提交</button>
          </div>
        </div>
      </Modal>

      <Modal open={addModalOpen} title="新增后补备注" onClose={() => setAddModalOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">名称</label>
            <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">编号（可选，留空自动生成）</label>
            <input type="text" value={addCode} onChange={(e) => setAddCode(e.target.value)} placeholder="如 BZ-002" className={cn(inputCls, "font-mono")} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">备注内容</label>
            <textarea value={addRemark} onChange={(e) => setAddRemark(e.target.value)} rows={5} placeholder="请输入后补备注的详细说明..."
              className={cn(inputCls, "resize-none")} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setAddModalOpen(false)} className="btn">取消</button>
            <button onClick={handleSubmitAdd} disabled={!addRemark.trim()} className="btn btn-warn disabled:opacity-50 disabled:cursor-not-allowed">
              <Pin className="w-4 h-4" />追加后补备注
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
