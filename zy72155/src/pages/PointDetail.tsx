import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  School,
  Navigation,
  Tag,
  RefreshCw,
  MessageSquare,
  GitMerge,
  ClipboardList,
  FileText,
  Plus,
  Check,
  X,
} from "lucide-react";
import { useStore } from "@/store";
import { STATUS_LABELS, SOURCE_TYPE_LABELS, PointStatus } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const STATUS_OPTIONS: PointStatus[] = ["processed", "pending", "field_review"];

export default function PointDetail() {
  const { id } = useParams<{ id: string }>();

  const points = useStore((s) => s.points);
  const feedbacks = useStore((s) => s.feedbacks);
  const aliases = useStore((s) => s.aliases);
  const merges = useStore((s) => s.merges);
  const judgments = useStore((s) => s.judgments);
  const plans = useStore((s) => s.plans);
  const changePointStatus = useStore((s) => s.changePointStatus);
  const resolveMerge = useStore((s) => s.resolveMerge);
  const addPlan = useStore((s) => s.addPlan);

  const point = points.find((p) => p.id === id);

  const pointFeedbacks = useMemo(
    () =>
      feedbacks
        .filter((f) => f.pointId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [feedbacks, id]
  );

  const pointAliases = useMemo(
    () => aliases.filter((a) => a.pointId === id),
    [aliases, id]
  );

  const pointMerges = useMemo(
    () =>
      merges.filter(
        (m) =>
          (m.sourcePointId === id || m.targetPointId === id) && m.status === "pending"
      ),
    [merges, id]
  );

  const pointJudgments = useMemo(
    () =>
      judgments
        .filter((j) => j.pointId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [judgments, id]
  );

  const pointPlans = useMemo(
    () =>
      plans
        .filter((p) => p.pointId === id)
        .sort((a, b) => a.versionNumber - b.versionNumber),
    [plans, id]
  );

  const [newStatus, setNewStatus] = useState<PointStatus>("processed");
  const [reason, setReason] = useState("");
  const [operator, setOperator] = useState("");

  const [planDesc, setPlanDesc] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [planChangedBy, setPlanChangedBy] = useState("");

  if (!point) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4" style={{ backgroundColor: "#f8fafb" }}>
        <MapPin size={48} className="text-gray-300" />
        <p className="text-gray-500">未找到该点位</p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#1A535C" }}
        >
          <ArrowLeft size={14} />
          返回看板
        </Link>
      </div>
    );
  }

  const handleStatusChange = () => {
    if (!reason.trim() || !operator.trim()) return;
    changePointStatus(point.id, newStatus, reason.trim(), operator.trim());
    setReason("");
    setOperator("");
  };

  const handleResolveMerge = (mergeId: string, confirmed: boolean) => {
    resolveMerge(mergeId, confirmed, "当前用户");
  };

  const handleAddPlan = () => {
    if (!planDesc.trim() || !planChangedBy.trim()) return;
    addPlan({
      id: `plan-${Date.now()}`,
      pointId: point.id,
      versionNumber: pointPlans.length + 1,
      description: planDesc.trim(),
      changedBy: planChangedBy.trim(),
      changeNote: planNote.trim(),
      createdAt: new Date().toISOString(),
    });
    setPlanDesc("");
    setPlanNote("");
    setPlanChangedBy("");
  };

  const isEmpty = !point.standardName;

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "#f8fafb" }}>
      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
            >
              <ArrowLeft size={14} />
              返回
            </Link>
            <h1 className="text-lg font-bold" style={{ color: "#1A535C" }}>
              点位详情
            </h1>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          {/* 基本信息 */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold" style={{ color: "#1A535C" }}>
              <MapPin size={16} />
              基本信息
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-20 shrink-0 text-sm text-gray-500">标准名称</span>
                <span className="text-sm font-medium text-gray-900">
                  {isEmpty ? "（空）" : point.standardName}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-20 shrink-0 text-sm text-gray-500">所属学校</span>
                <span className="flex items-center gap-1.5 text-sm text-gray-900">
                  <School size={13} className="text-gray-400" />
                  {point.schoolName || "（空）"}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-20 shrink-0 text-sm text-gray-500">坐标</span>
                <span className="flex items-center gap-1.5 text-sm text-gray-900">
                  <Navigation size={13} className="text-gray-400" />
                  {point.latitude != null && point.longitude != null
                    ? `${point.latitude}, ${point.longitude}`
                    : "未设置"}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-20 shrink-0 text-sm text-gray-500">当前状态</span>
                <StatusBadge status={point.status} />
              </div>
              {pointAliases.length > 0 && (
                <div className="flex items-start gap-3">
                  <span className="w-20 shrink-0 text-sm text-gray-500">别名</span>
                  <div className="flex flex-wrap gap-1.5">
                    {pointAliases.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-700"
                      >
                        <Tag size={10} className="text-gray-400" />
                        {a.alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-gray-100 pt-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <RefreshCw size={14} />
                状态变更
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">目标状态</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as PointStatus)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="mb-1 block text-xs text-gray-500">原因</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="输入变更原因"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                  />
                </div>
                <div className="min-w-[100px]">
                  <label className="mb-1 block text-xs text-gray-500">操作人</label>
                  <input
                    type="text"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    placeholder="操作人"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                  />
                </div>
                <button
                  onClick={handleStatusChange}
                  disabled={!reason.trim() || !operator.trim()}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "#FF6B35" }}
                >
                  提交
                </button>
              </div>
            </div>
          </section>

          {/* 反馈时间线 */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold" style={{ color: "#1A535C" }}>
              <MessageSquare size={16} />
              反馈时间线
              <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: "#FF6B35" }}>
                {pointFeedbacks.length}
              </span>
            </h2>
            {pointFeedbacks.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">暂无反馈</p>
            ) : (
              <div className="relative ml-3">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200" />
                <div className="space-y-5">
                  {pointFeedbacks.map((fb) => (
                    <div key={fb.id} className="relative pl-7">
                      <div
                        className="absolute left-[-4px] top-2 h-[9px] w-[9px] rounded-full border-2 border-white"
                        style={{ backgroundColor: "#FF6B35" }}
                      />
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                        <p className="mb-2 text-sm font-semibold text-gray-900" style={{ color: "#1A535C" }}>
                          {fb.originalText}
                        </p>
                        <p className="mb-2 text-sm text-gray-700">{fb.content}</p>
                        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span className="rounded bg-white px-2 py-0.5 font-medium" style={{ color: "#1A535C" }}>
                            {SOURCE_TYPE_LABELS[fb.sourceType]}
                          </span>
                          <span>{fb.sourceDetail}</span>
                          <span>{fb.feedbackDate}</span>
                        </div>
                        {fb.rawRemark && (
                          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 whitespace-pre-wrap break-all">
                            {fb.rawRemark}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 归并建议 */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold" style={{ color: "#1A535C" }}>
              <GitMerge size={16} />
              归并建议
              {pointMerges.length > 0 && (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: "#FF6B35" }}>
                  {pointMerges.length}
                </span>
              )}
            </h2>
            {pointMerges.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">暂无归并建议</p>
            ) : (
              <div className="space-y-3">
                {pointMerges.map((m) => {
                  const otherPointId = m.sourcePointId === id ? m.targetPointId : m.sourcePointId;
                  const otherPoint = points.find((p) => p.id === otherPointId);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {otherPoint ? otherPoint.standardName || "（空记录）" : "未知点位"}
                        </p>
                        <p className="text-xs text-gray-500">
                          相似度：{(m.similarity * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResolveMerge(m.id, true)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
                          style={{ backgroundColor: "#1A535C" }}
                        >
                          <Check size={12} />
                          确认归并
                        </button>
                        <button
                          onClick={() => handleResolveMerge(m.id, false)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                        >
                          <X size={12} />
                          拒绝
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 判断记录 */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold" style={{ color: "#1A535C" }}>
              <ClipboardList size={16} />
              判断记录
            </h2>
            {pointJudgments.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">暂无判断记录</p>
            ) : (
              <div className="relative ml-3">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200" />
                <div className="space-y-5">
                  {pointJudgments.map((j) => (
                    <div key={j.id} className="relative pl-7">
                      <div
                        className="absolute left-[-4px] top-2 h-[9px] w-[9px] rounded-full border-2 border-white"
                        style={{ backgroundColor: "#1A535C" }}
                      />
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                          <span
                            className="rounded px-2 py-0.5 text-xs"
                            style={{ backgroundColor: "#e0f2f1", color: "#1A535C" }}
                          >
                            {j.fromStatus ? STATUS_LABELS[j.fromStatus] : "新建"}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span
                            className="rounded px-2 py-0.5 text-xs"
                            style={{ backgroundColor: "#fff3e0", color: "#FF6B35" }}
                          >
                            {STATUS_LABELS[j.toStatus]}
                          </span>
                        </div>
                        <p className="mb-1 text-sm text-gray-700">{j.reason}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{j.operator}</span>
                          <span>{formatDateTime(j.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 方案版本 */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold" style={{ color: "#1A535C" }}>
              <FileText size={16} />
              方案版本
            </h2>
            {pointPlans.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">暂无方案版本</p>
            ) : (
              <div className="mb-5 space-y-3">
                {pointPlans.map((pv) => (
                  <div key={pv.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: "#1A535C" }}
                      >
                        v{pv.versionNumber}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{pv.description}</span>
                    </div>
                    {pv.changeNote && (
                      <p className="mb-2 text-sm text-gray-600">{pv.changeNote}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{pv.changedBy}</span>
                      <span>{formatDateTime(pv.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 pt-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Plus size={14} />
                新增方案版本
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">描述</label>
                  <input
                    type="text"
                    value={planDesc}
                    onChange={(e) => setPlanDesc(e.target.value)}
                    placeholder="方案描述"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">变更说明</label>
                  <input
                    type="text"
                    value={planNote}
                    onChange={(e) => setPlanNote(e.target.value)}
                    placeholder="变更说明（可选）"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                  />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-gray-500">操作人</label>
                    <input
                      type="text"
                      value={planChangedBy}
                      onChange={(e) => setPlanChangedBy(e.target.value)}
                      placeholder="操作人"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                    />
                  </div>
                  <button
                    onClick={handleAddPlan}
                    disabled={!planDesc.trim() || !planChangedBy.trim()}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-40"
                    style={{ backgroundColor: "#FF6B35" }}
                  >
                    新增
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
