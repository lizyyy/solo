import { useState } from "react";
import { useMaterialsStore } from "@/stores/useMaterialsStore";
import { useModelStore } from "@/stores/useModelStore";
import { Package, Plus, AlertTriangle, CheckCircle2, Search, Filter } from "lucide-react";
import { ImportanceBadge } from "@/components/StatusBadges";
import DecisionBanner from "@/components/DecisionBanner";
import { useUIGlobalStore } from "@/stores/useUIGlobalStore";
import { StructuralImportance, MaterialBatch } from "@/types";

type MaterialBatchInput = Omit<MaterialBatch, "id" | "createdAt">;

export default function MaterialsPage() {
  const { batches, addBatch, updateBatch, removeBatch, getDecision, getBatchesForAnnotation } =
    useMaterialsStore();
  const { annotations } = useModelStore();
  const { showToast } = useUIGlobalStore();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "missing" | "ok">("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<MaterialBatchInput>({
    annotationId: annotations[0]?.id || "",
    materialType: "",
    batchNumber: "",
    testReport: "",
    isMissing: false,
  });

  const grouped = annotations.map((a) => {
    const b = getBatchesForAnnotation(a.id);
    const dec = getDecision(a.id);
    return { annotation: a, batches: b, decision: dec };
  });

  const filteredGroups = grouped.filter((g) => {
    if (filter === "missing" && !g.batches.some((x) => x.isMissing)) return false;
    if (filter === "ok" && g.batches.some((x) => x.isMissing)) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        g.annotation.locationCode.toLowerCase().includes(q) ||
        g.annotation.area.toLowerCase().includes(q) ||
        g.batches.some((b) => b.materialType.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalMissing = batches.filter((b) => b.isMissing).length;
  const totalOk = batches.length - totalMissing;

  const handleSubmit = () => {
    if (!form.materialType) {
      showToast("error", "请填写材料类型");
      return;
    }
    addBatch(form);
    showToast("success", `材料批次已登记：${form.materialType}`);
    setForm({
      annotationId: annotations[0]?.id || "",
      materialType: "",
      batchNumber: "",
      testReport: "",
      isMissing: false,
    });
    setShowForm(false);
  };

  const importanceSort: Record<StructuralImportance, number> = {
    critical: 0,
    normal: 1,
    minor: 2,
  };
  filteredGroups.sort(
    (a, b) => importanceSort[a.annotation.structuralImportance] - importanceSort[b.annotation.structuralImportance]
  );

  return (
    <div className="space-y-6">
      {/* 顶部 */}
      <div className="eng-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-ink-900 flex items-center gap-2 mb-1">
            <Package size={18} className="text-brand-600" />
            材料批次校验
          </h2>
          <p className="text-xs text-ink-500">
            自动按 <b>结构重要性 × 材料缺失状态</b> 给出挂起/放行/评估建议
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-eng bg-safe-50 text-safe-700 border border-safe-200 font-bold">
              <CheckCircle2 size={12} /> 齐全 {totalOk}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-eng bg-danger-50 text-danger-700 border border-danger-200 font-bold">
              <AlertTriangle size={12} /> 缺失 {totalMissing}
            </span>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="eng-btn-primary">
            <Plus size={14} />
            登记材料批次
          </button>
        </div>
      </div>

      {/* 决策矩阵说明 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {[
          {
            title: "关键结构 × 缺失 → 必须挂起",
            desc: "剪力墙、承重柱等部位材料缺失，直接影响安全",
            color: "danger",
          },
          {
            title: "普通构件 × 缺失 → 需评估",
            desc: "一般梁、板等部位，总工判断后可放行",
            color: "warn",
          },
          {
            title: "次要装饰 × 缺失 → 可放行",
            desc: "装饰性构件、附属结构，后续补录即可",
            color: "safe",
          },
        ].map((r, i) => (
          <div
            key={i}
            className={`p-4 rounded-eng border bg-${r.color}-50 border-${r.color}-200`}
          >
            <div className={`text-sm font-black text-${r.color}-800 mb-1`}>{r.title}</div>
            <div className={`text-xs text-${r.color}-700/80`}>{r.desc}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="eng-card p-5 grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-ink-700 mb-1">关联标注位置</label>
            <select
              className="eng-input"
              value={form.annotationId}
              onChange={(e) => setForm({ ...form, annotationId: e.target.value })}
            >
              {annotations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.locationCode} · {a.area}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-700 mb-1">材料类型</label>
            <input
              className="eng-input"
              placeholder="如：Q345钢板8mm"
              value={form.materialType}
              onChange={(e) => setForm({ ...form, materialType: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-700 mb-1">批次号</label>
            <input
              className="eng-input"
              placeholder="如：JG-202605-012"
              value={form.batchNumber}
              onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-700 mb-1">检测报告</label>
            <input
              className="eng-input"
              placeholder="如：TR-JG-0528-03"
              value={form.testReport}
              onChange={(e) => setForm({ ...form, testReport: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm bg-danger-50 border border-danger-200 px-3 py-2 rounded-eng cursor-pointer">
              <input
                type="checkbox"
                checked={form.isMissing}
                onChange={(e) => setForm({ ...form, isMissing: e.target.checked })}
              />
              <span className="text-danger-700 font-bold">标记缺失</span>
            </label>
            <button onClick={handleSubmit} className="eng-btn-primary flex-1">
              保存
            </button>
          </div>
        </div>
      )}

      {/* 筛选 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="eng-input pl-9"
            placeholder="搜索位置编码 / 区域 / 材料类型"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 border border-ink-200 rounded-eng overflow-hidden bg-white">
          <Filter size={13} className="text-ink-500 mx-2" />
          {(["all", "missing", "ok"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-brand-600 text-white"
                  : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              {f === "all" ? "全部" : f === "missing" ? "只看缺失" : "只看齐全"}
            </button>
          ))}
        </div>
      </div>

      {/* 分组列表 */}
      <div className="space-y-4">
        {filteredGroups.map((g) => (
          <div key={g.annotation.id} className="eng-card overflow-hidden">
            <div className="px-5 py-3 border-b border-ink-100 flex flex-wrap items-center gap-4 bg-ink-50/60">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono font-black text-brand-700 text-sm">
                    {g.annotation.locationCode}
                  </span>
                  <span className="text-xs text-ink-600 font-medium">
                    {g.annotation.floor} · {g.annotation.area}
                  </span>
                  <ImportanceBadge importance={g.annotation.structuralImportance} />
                </div>
                <div className="text-xs text-ink-500">{g.annotation.description}</div>
              </div>
              <div className="ml-auto flex items-center gap-3 text-xs">
                <span className="eng-tag bg-ink-100 text-ink-700">
                  材料 {g.batches.length} 项 · 缺{" "}
                  <b className="text-danger-700">{g.batches.filter((b) => b.isMissing).length}</b>
                </span>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {g.decision && (g.decision.decision || g.batches.length > 0) && (
                <DecisionBanner
                  decision={g.decision.decision}
                  reason={g.decision.reason}
                  onHold={() => showToast("warning", "已确认挂起，已同步至异常队列")}
                  onRelease={() => showToast("success", "已放行，记录在案")}
                  onEvaluate={() => showToast("info", "已提交总工评估")}
                />
              )}
              <table className="w-full text-sm">
                <thead className="text-xs text-ink-600">
                  <tr className="border-b border-ink-100">
                    <th className="text-left py-2 font-bold w-[180px]">材料类型</th>
                    <th className="text-left py-2 font-bold">批次号</th>
                    <th className="text-left py-2 font-bold">检测报告</th>
                    <th className="text-left py-2 font-bold w-[80px]">状态</th>
                    <th className="text-right py-2 font-bold w-[120px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {g.batches.map((b) => (
                    <tr key={b.id} className="border-b border-ink-50 hover:bg-ink-50/40">
                      <td className="py-2.5 font-bold text-ink-800">{b.materialType}</td>
                      <td className="py-2.5 font-mono text-xs text-ink-600">
                        {b.batchNumber || <span className="text-danger-500 italic">未录入</span>}
                      </td>
                      <td className="py-2.5 font-mono text-xs text-ink-600">
                        {b.testReport || <span className="text-danger-500 italic">未录入</span>}
                      </td>
                      <td className="py-2.5">
                        {b.isMissing ? (
                          <span className="eng-tag bg-danger-50 text-danger-700 border border-danger-200">
                            <AlertTriangle size={10} /> 缺失
                          </span>
                        ) : (
                          <span className="eng-tag bg-safe-50 text-safe-700 border border-safe-200">
                            <CheckCircle2 size={10} /> 齐全
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => {
                            updateBatch(b.id, { isMissing: !b.isMissing });
                            showToast(
                              "info",
                              `${b.materialType} 已标记为${!b.isMissing ? "缺失" : "齐全"}`
                            );
                          }}
                          className="eng-btn !py-1 !px-2 text-xs"
                        >
                          切换状态
                        </button>
                        <button
                          onClick={() => {
                            removeBatch(b.id);
                            showToast("info", "已删除");
                          }}
                          className="eng-btn !py-1 !px-2 text-xs hover:!text-danger-700"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                  {g.batches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-ink-400 text-xs">
                        该标注暂未登记材料，请点击顶部「登记材料批次」
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <div className="eng-card p-12 text-center text-ink-400">
            <Search size={32} className="mx-auto mb-2 opacity-50" />
            没有匹配的材料批次
          </div>
        )}
      </div>
    </div>
  );
}
