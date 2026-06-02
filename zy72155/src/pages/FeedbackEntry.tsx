import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Crosshair,
  List,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import { useStore } from "@/store";
import { SOURCE_TYPE_LABELS, Feedback } from "@/types";

const INITIAL_FORM = {
  pointName: "",
  content: "",
  sourceType: "resident_form" as Feedback["sourceType"],
  sourceDetail: "",
  rawRemark: "",
  feedbackDate: "",
  operator: "",
};

export default function FeedbackEntry() {

  const points = useStore((s) => s.points);
  const feedbacks = useStore((s) => s.feedbacks);
  const addFeedback = useStore((s) => s.addFeedback);
  const importFeedbackAndMatch = useStore((s) => s.importFeedbackAndMatch);

  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedPointId, setSelectedPointId] = useState("");
  const [showPointDropdown, setShowPointDropdown] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildFeedback = (pointId: string): Feedback => ({
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pointId,
    originalText: form.pointName,
    content: form.content,
    sourceType: form.sourceType,
    sourceDetail: form.sourceDetail,
    rawRemark: form.rawRemark,
    feedbackDate: form.feedbackDate,
    createdAt: new Date().toISOString(),
  });

  const handleMatchAndAdd = () => {
    if (!form.pointName.trim() || !form.content.trim()) return;
    importFeedbackAndMatch(buildFeedback(""), form.pointName.trim());
    setSuccessMsg("录入成功，已自动匹配或创建点位");
    setForm(INITIAL_FORM);
    setShowPointDropdown(false);
    setSelectedPointId("");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleAddToSelected = () => {
    if (!form.pointName.trim() || !form.content.trim() || !selectedPointId) return;
    addFeedback(buildFeedback(selectedPointId));
    setSuccessMsg("录入成功，已添加到指定点位");
    setForm(INITIAL_FORM);
    setShowPointDropdown(false);
    setSelectedPointId("");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const recentFeedbacks = feedbacks
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const isFormValid = form.pointName.trim() !== "" && form.content.trim() !== "";

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "#f8fafb" }}>
      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
            >
              <ArrowLeft size={14} />
              返回
            </Link>
            <h1 className="text-lg font-bold" style={{ color: "#1A535C" }}>
              反馈录入
            </h1>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 p-6">
          {successMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              <CheckCircle size={16} />
              {successMsg}
            </div>
          )}

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold" style={{ color: "#1A535C" }}>
              <Plus size={16} />
              新建反馈
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">点位写法</label>
                <input
                  type="text"
                  value={form.pointName}
                  onChange={(e) => updateField("pointName", e.target.value)}
                  placeholder="请输入点位名称"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                />
                <p className="mt-1 text-xs text-gray-400">保留居民反馈表中的原始写法</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">反馈内容</label>
                <textarea
                  value={form.content}
                  onChange={(e) => updateField("content", e.target.value)}
                  placeholder="请输入反馈内容"
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">来源类型</label>
                <select
                  value={form.sourceType}
                  onChange={(e) => updateField("sourceType", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                >
                  {Object.entries(SOURCE_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">来源详情</label>
                <input
                  type="text"
                  value={form.sourceDetail}
                  onChange={(e) => updateField("sourceDetail", e.target.value)}
                  placeholder="请输入来源详情"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">原始备注</label>
                <textarea
                  value={form.rawRemark}
                  onChange={(e) => updateField("rawRemark", e.target.value)}
                  placeholder="请输入原始备注"
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                />
                <p className="mt-1 text-xs text-gray-400">保留原始乱备注，不要整理或清洗</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">反馈日期</label>
                <input
                  type="date"
                  value={form.feedbackDate}
                  onChange={(e) => updateField("feedbackDate", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">操作人</label>
                <input
                  type="text"
                  value={form.operator}
                  onChange={(e) => updateField("operator", e.target.value)}
                  placeholder="请输入操作人"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={handleMatchAndAdd}
                disabled={!isFormValid}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-40"
                style={{ backgroundColor: "#1A535C" }}
              >
                <Crosshair size={16} />
                录入并匹配点位
              </button>

              <div>
                <button
                  onClick={() => setShowPointDropdown((prev) => !prev)}
                  disabled={!isFormValid}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40"
                  style={{ color: "#FF6B35", borderColor: "#FF6B35" }}
                >
                  <List size={16} />
                  录入到指定点位
                </button>

                {showPointDropdown && (
                  <div className="mt-3 space-y-3">
                    <select
                      value={selectedPointId}
                      onChange={(e) => setSelectedPointId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                    >
                      <option value="">请选择点位</option>
                      {points.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.standardName || `点位 ${p.id}`}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddToSelected}
                      disabled={!selectedPointId}
                      className="w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-40"
                      style={{ backgroundColor: "#FF6B35" }}
                    >
                      确认录入
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold" style={{ color: "#1A535C" }}>
              <MessageSquare size={16} />
              最近反馈
              <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: "#FF6B35" }}>
                {recentFeedbacks.length}
              </span>
            </h2>

            {recentFeedbacks.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">暂无反馈记录</p>
            ) : (
              <div className="space-y-3">
                {recentFeedbacks.map((fb) => {
                  const point = points.find((p) => p.id === fb.pointId);
                  return (
                    <div key={fb.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "#1A535C" }}>
                          {point?.standardName || fb.originalText || "未知点位"}
                        </span>
                        <span className="rounded px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#e0f2f1", color: "#1A535C" }}>
                          {SOURCE_TYPE_LABELS[fb.sourceType]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{fb.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
