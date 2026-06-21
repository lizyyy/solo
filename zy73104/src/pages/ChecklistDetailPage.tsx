import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeftRight,
  X,
  AlertCircle,
  Undo2,
  Send,
  Edit3,
  Download,
  Eye,
  MapPin,
} from "lucide-react";
import { useChecklistStore } from "@/store/useChecklistStore";
import { STATUS_LABEL, ROLE_LABEL } from "shared/types";
import type { ChecklistStatus, DrainPoint } from "shared/types";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import VersionChip from "@/components/VersionChip";
import RoofThreeScene, { VIEW_LABELS, type ViewAngle } from "@/components/RoofThreeScene";
import ExportPreviewModal from "@/components/ExportPreviewModal";
import { cn } from "@/lib/utils";

export default function ChecklistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    checklists,
    fetchChecklists,
    fetchOne,
    currentRole,
    changeStatus,
    addNote,
    withdrawNote,
    loading,
  } = useChecklistStore();

  const [showChangeModal, setShowChangeModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [newStatus, setNewStatus] = useState<ChecklistStatus>("confirmed");
  const [changeReason, setChangeReason] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isSupplementary, setIsSupplementary] = useState(false);
  const [viewAngle, setViewAngle] = useState<ViewAngle>("isometric");
  const [selectedPointId, setSelectedPointId] = useState<string | undefined>();

  const descriptionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (checklists.length === 0) {
      fetchChecklists();
    }
  }, [checklists.length, fetchChecklists]);

  const checklist = useMemo(() => {
    if (!id) return undefined;
    return fetchOne(id);
  }, [id, checklists, fetchOne]);

  useEffect(() => {
    if (checklist && checklist.drainPoints.length > 0 && !selectedPointId) {
      setSelectedPointId(checklist.drainPoints[0].id);
    }
  }, [checklist, selectedPointId]);

  const handleChangeStatus = async () => {
    if (!id || !checklist || !changeReason.trim()) return;
    await changeStatus(id, newStatus, changeReason.trim(), currentRole);
    setShowChangeModal(false);
    setChangeReason("");
  };

  const handleAddNote = async () => {
    if (!id || !noteContent.trim()) return;
    await addNote(id, {
      content: noteContent.trim(),
      createdBy: currentRole,
      isSupplementary,
    });
    setNoteContent("");
    setIsSupplementary(false);
  };

  const handleWithdrawNote = async (noteId: string) => {
    if (!id) return;
    await withdrawNote(id, noteId, currentRole);
  };

  const handlePointSelect = (pointId: string) => {
    setSelectedPointId(pointId);
    const el = descriptionRefs.current[pointId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  if (loading || !checklist) {
    return (
      <div className="min-h-screen bg-ink-50">
        <AppHeader showBack />
        <div className="max-w-7xl mx-auto px-6 py-12 text-center text-ink-500">
          加载中...
        </div>
      </div>
    );
  }

  const sortedBimNotes = [...checklist.bimNotes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const viewOptions: { key: ViewAngle; label: string; icon: string }[] = [
    { key: "top", label: "俯视", icon: "⬇" },
    { key: "isometric", label: "轴测", icon: "◆" },
    { key: "closeup", label: "局部", icon: "◉" },
  ];

  return (
    <div className="min-h-screen bg-ink-50">
      <AppHeader
        breadcrumb={[{ label: "清单列表", to: "/" }, { label: checklist.code }]}
        showBack
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="font-mono text-sm text-ink-500">
                  {checklist.code}
                </span>
                <h1 className="font-serif text-2xl font-bold text-ink-900 truncate">
                  {checklist.projectName}
                </h1>
              </div>
              <div className="flex items-center gap-4 text-xs text-ink-500">
                <span>图层：{checklist.layerName}</span>
                <span>创建：{checklist.createdAt}</span>
                <span>更新：{checklist.updatedAt}</span>
                <span>处理人：{ROLE_LABEL[checklist.handledBy]}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <StatusBadge status={checklist.status} className="text-sm px-3 py-1" />
              <button
                onClick={() => setShowExportModal(true)}
                className="btn-ghost"
              >
                <Download className="w-4 h-4" />
                导出
              </button>
              <button
                onClick={() => {
                  setNewStatus(checklist.status);
                  setShowChangeModal(true);
                }}
                className="btn-primary"
              >
                <ArrowLeftRight className="w-4 h-4" />
                发起改判
              </button>
              <Link to={`/checklist/${checklist.id}/edit`} className="btn-ghost">
                <Edit3 className="w-4 h-4" />
                编辑
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-7 space-y-6">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-ink-200 bg-ink-50">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-brand-600" />
                  <h2 className="font-serif text-base font-semibold text-ink-800">
                    BIM 场景视图
                  </h2>
                  <span className="text-xs text-ink-500 font-mono ml-2">
                    {VIEW_LABELS[viewAngle]}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-white rounded-sm2 border border-ink-200 p-0.5">
                  {viewOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setViewAngle(opt.key)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-sm2 transition-all flex items-center gap-1.5",
                        viewAngle === opt.key
                          ? "bg-brand-600 text-white shadow-sm"
                          : "text-ink-600 hover:bg-ink-100"
                      )}
                    >
                      <span className="text-sm">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative" style={{ height: "460px" }}>
                <RoofThreeScene
                  drainPoints={checklist.drainPoints}
                  selectedPointId={selectedPointId}
                  onPointSelect={handlePointSelect}
                  viewAngle={viewAngle}
                  className="w-full h-full"
                />

                <div className="absolute left-4 bottom-4 flex items-center gap-1.5 text-[10px] text-ink-500 bg-white/80 backdrop-blur-sm px-2.5 py-1.5 rounded-sm2 border border-ink-200">
                  <MapPin className="w-3 h-3 text-brand-600" />
                  <span>点击标注点定位说明 · 鼠标拖拽旋转 · 滚轮缩放</span>
                </div>

                {selectedPointId && (
                  <div className="absolute right-4 top-4 bg-white/90 backdrop-blur-sm rounded-sm2 border border-ink-200 px-3 py-2 shadow-sm max-w-[200px]">
                    <div className="text-[10px] text-brand-600 font-medium mb-0.5">
                      当前选中
                    </div>
                    <div className="text-sm font-semibold text-ink-800">
                      {checklist.drainPoints.find((p) => p.id === selectedPointId)?.label}
                    </div>
                    <div className="text-[10px] text-ink-500 font-mono mt-0.5">
                      {checklist.drainPoints.find((p) => p.id === selectedPointId)?.apiField}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="section-title mb-4">标注点位</h2>
              <div className="space-y-2">
                {checklist.drainPoints.map((point, idx) => (
                  <div
                    key={point.id}
                    ref={(el) => {
                      descriptionRefs.current[point.id] = el;
                    }}
                    onClick={() => handlePointSelect(point.id)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-sm2 border cursor-pointer transition-all",
                      selectedPointId === point.id
                        ? "border-brand-400 bg-brand-50 shadow-sm"
                        : "border-ink-200 hover:bg-ink-50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5",
                        selectedPointId === point.id ? "bg-brand-700" : "bg-brand-600"
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink-800">
                        {point.label}
                      </div>
                      <div className="text-xs text-ink-500 font-mono mt-0.5">
                        {point.apiField}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="section-title mb-3">图纸版本</h2>
              <div className="flex flex-wrap gap-2">
                {checklist.versions.map((v) => (
                  <VersionChip key={v.version} version={v} />
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-5 space-y-5">
            <div className="card p-5 bg-ink-100 border-ink-200">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="section-title !mb-0">交底说明（与模型标注同源）</h2>
              </div>
              <div className="space-y-2.5 mb-3">
                {checklist.drainPoints.map((point, idx) => (
                  <div
                    key={point.id}
                    ref={(el) => {
                      descriptionRefs.current[point.id] = el;
                    }}
                    className={cn(
                      "flex items-start gap-2.5 bg-white p-3 rounded-sm2 border transition-all",
                      selectedPointId === point.id
                        ? "border-brand-400 ring-2 ring-brand-100 shadow-sm"
                        : "border-ink-200"
                    )}
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5",
                        selectedPointId === point.id ? "bg-brand-700" : "bg-brand-600"
                      )}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink-800 mb-0.5">
                        {point.label}
                      </div>
                      <p className="text-xs text-ink-600 leading-relaxed">
                        {point.description}
                      </p>
                      <div className="text-[10px] text-ink-400 font-mono mt-1">
                        api: {point.apiField}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-ink-500 border-t border-ink-200 pt-2.5">
                本说明与模型标注、接口返回字段同源 — 数据唯一来源
              </p>
            </div>

            <div className="card p-5">
              <h2 className="section-title mb-3">BIM 备注时间线</h2>

              <div className="relative pl-6 space-y-3.5 mb-5 max-h-[380px] overflow-y-auto pr-2">
                <div className="absolute left-[11px] top-1 bottom-1 w-0.5 bg-ink-200" />

                {sortedBimNotes.length === 0 && (
                  <div className="text-center text-sm text-ink-400 py-8">
                    暂无备注
                  </div>
                )}

                {sortedBimNotes.map((note) => (
                  <div
                    key={note.id}
                    className={cn(
                      "relative rounded-sm2 border p-3",
                      note.isWithdrawn
                        ? "bg-red-50 border-red-200"
                        : "bg-white border-ink-200"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute -left-[19px] top-3.5 w-4 h-4 rounded-full border-2 shrink-0",
                        note.isWithdrawn
                          ? "bg-red-400 border-red-600"
                          : "bg-white border-ink-400"
                      )}
                    />

                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            note.isWithdrawn
                              ? "text-red-600 line-through"
                              : "text-ink-700"
                          )}
                        >
                          {ROLE_LABEL[note.createdBy]}
                        </span>
                        {note.isWithdrawn && (
                          <span className="chip bg-red-100 text-red-700 border-none italic text-[10px]">
                            已撤回
                          </span>
                        )}
                        {note.isSupplementary && !note.isWithdrawn && (
                          <span className="chip bg-yellow-100 text-yellow-800 border border-yellow-300 text-[10px]">
                            后补
                          </span>
                        )}
                        {note.versionTag && (
                          <span className="chip bg-ink-100 text-ink-600 border-none font-mono text-[10px]">
                            {note.versionTag}
                          </span>
                        )}
                      </div>

                      {!note.isWithdrawn && currentRole === "architect" && (
                        <button
                          onClick={() => handleWithdrawNote(note.id)}
                          className="shrink-0 text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1"
                        >
                          <Undo2 className="w-3 h-3" />
                          撤回
                        </button>
                      )}
                    </div>

                    <p
                      className={cn(
                        "text-sm mb-2 leading-relaxed",
                        note.isWithdrawn
                          ? "text-red-600 line-through"
                          : "text-ink-800"
                      )}
                    >
                      {note.content}
                    </p>

                    <div className="text-[11px] text-ink-500 flex items-center gap-3 flex-wrap">
                      <span>{note.createdAt}</span>
                      {note.isWithdrawn && note.withdrawnAt && (
                        <span className="text-red-500">
                          撤回于 {note.withdrawnAt} ·{" "}
                          {note.withdrawnBy ? ROLE_LABEL[note.withdrawnBy] : ""}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-ink-200 pt-4 space-y-3">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="添加 BIM 备注..."
                  rows={3}
                  className="input-base resize-none text-sm"
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-ink-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isSupplementary}
                      onChange={(e) => setIsSupplementary(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-sm2 border-ink-300 text-brand-600 focus:ring-brand-400"
                    />
                    追加为后补说明
                  </label>
                  <button
                    onClick={handleAddNote}
                    disabled={!noteContent.trim()}
                    className="btn-primary text-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    提交
                  </button>
                </div>
              </div>
            </div>

            {checklist.revisions.length > 0 && (
              <div className="card p-5">
                <h2 className="section-title mb-3">改判差异</h2>
                <div className="space-y-4">
                  {checklist.revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="border border-ink-200 rounded-sm2 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-0">
                        <div className="p-3.5 bg-ink-50 border-r border-ink-200">
                          <div className="text-[11px] text-ink-500 mb-1.5 font-medium">
                            改判前
                          </div>
                          <StatusBadge status={rev.fromStatus} className="text-xs" />
                        </div>
                        <div className="p-3.5 bg-orange-50 border border-orange-200 border-t-0 border-r-0 border-b-0">
                          <div className="text-[11px] text-orange-700 mb-1.5 font-medium">
                            改判后
                          </div>
                          <StatusBadge status={rev.toStatus} className="text-xs" />
                        </div>
                      </div>

                      <div className="px-3.5 py-3 bg-white border-t border-ink-200">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                          <p className="text-sm text-ink-700 leading-relaxed">
                            {rev.reason}
                          </p>
                        </div>
                      </div>

                      {rev.fieldChanges.length > 0 && (
                        <div className="border-t border-ink-200">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="bg-ink-50">
                                <th className="text-left px-2.5 py-2 font-medium text-ink-600 border-b border-ink-200">
                                  字段
                                </th>
                                <th className="text-left px-2.5 py-2 font-medium text-ink-600 border-b border-ink-200">
                                  原值
                                </th>
                                <th className="text-left px-2.5 py-2 font-medium text-ink-600 border-b border-ink-200">
                                  新值
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rev.fieldChanges.map((fc, idx) => (
                                <tr
                                  key={idx}
                                  className="border-b border-ink-100 last:border-b-0"
                                >
                                  <td className="px-2.5 py-1.5 text-ink-500 font-mono">
                                    {fc.field}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-ink-700 line-through text-ink-500">
                                    {fc.oldValue}
                                  </td>
                                  <td className="px-2.5 py-1.5 bg-yellow-50 font-medium text-ink-900">
                                    {fc.newValue}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="px-3.5 py-2 bg-ink-50 border-t border-ink-200 flex items-center justify-between text-[10px] text-ink-500 font-mono">
                        <span>{ROLE_LABEL[rev.changedBy]}</span>
                        <span>{rev.changedAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
          <div className="card w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-ink-200">
              <h3 className="font-serif text-lg font-semibold text-ink-900">
                发起改判
              </h3>
              <button
                onClick={() => setShowChangeModal(false)}
                className="p-1.5 rounded-sm2 hover:bg-ink-100 text-ink-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="label-base">原状态（只读）</label>
                <div className="input-base bg-ink-50 cursor-not-allowed">
                  <StatusBadge status={checklist.status} />
                </div>
              </div>

              <div>
                <label className="label-base">新状态</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ChecklistStatus)}
                  className="input-base"
                >
                  <option value="confirmed">已确认</option>
                  <option value="pending">待补件</option>
                  <option value="returned">退回</option>
                  <option value="suspended">挂起</option>
                </select>
              </div>

              <div>
                <label className="label-base">
                  改判原因 <span className="text-accent-returned">*</span>
                </label>
                <textarea
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="请填写改判原因，必填。接班同事会看到这条记录。"
                  rows={4}
                  className="input-base resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-ink-200 bg-ink-50">
              <button
                onClick={() => setShowChangeModal(false)}
                className="btn-ghost"
              >
                取消
              </button>
              <button
                onClick={handleChangeStatus}
                disabled={!changeReason.trim()}
                className="btn-primary"
              >
                确认改判
              </button>
            </div>
          </div>
        </div>
      )}

      <ExportPreviewModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        checklist={checklist}
        viewAngle={viewAngle}
      />
    </div>
  );
}
