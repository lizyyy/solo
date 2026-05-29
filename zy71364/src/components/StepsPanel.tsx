import { useState } from "react";
import { Plus, ChevronUp, ChevronDown, Zap, AlertCircle } from "lucide-react";
import { useStore } from "@/store/useStore";
import Modal from "@/components/Modal";
import AnomalyBadge from "@/components/AnomalyBadge";
import { STEP_TYPE_LABELS } from "../../shared/types";
import type { RestorationStep } from "../../shared/types";

interface Props {
  restorationId: string;
}

const typeColorMap: Record<RestorationStep["type"], string> = {
  cleaning: "bg-blue-50 text-blue-700 border-blue-200",
  color_correction: "bg-purple-50 text-purple-700 border-purple-200",
  reinforcement: "bg-green-50 text-green-700 border-green-200",
  other: "bg-gray-50 text-gray-700 border-gray-200",
};

export default function StepsPanel({ restorationId }: Props) {
  const { steps, anomalies, createStep, reorderSteps, triggerAnomalyCheck, fetchAnomalies, loading } = useStore();

  const [showAdd, setShowAdd] = useState(false);
  const [checking, setChecking] = useState(false);
  const [form, setForm] = useState({
    type: "cleaning" as RestorationStep["type"],
    description: "",
    notes: "",
    performedAt: new Date().toISOString().split("T")[0],
  });

  const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  const stepAnomalies = (stepId: string) =>
    anomalies.filter((a) => a.stepId === stepId);

  const handleAdd = async () => {
    try {
      await createStep(restorationId, {
        ...form,
        stepOrder: steps.length + 1,
      });
      setShowAdd(false);
      setForm({ type: "cleaning", description: "", notes: "", performedAt: new Date().toISOString().split("T")[0] });
    } catch {}
  };

  const handleReorder = async (currentIndex: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedSteps.length) return;
    const newSteps = [...sortedSteps];
    [newSteps[currentIndex], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[currentIndex]];
    const stepIds = newSteps.map((s) => s.id);
    await reorderSteps(restorationId, stepIds);
  };

  const handleAnomalyCheck = async () => {
    setChecking(true);
    try {
      await triggerAnomalyCheck(restorationId);
      await fetchAnomalies(restorationId);
    } catch {}
    setChecking(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-primary-800">修复步骤</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAnomalyCheck}
            disabled={checking}
            className="btn-secondary flex items-center gap-2"
          >
            <Zap size={14} />
            {checking ? "检测中..." : "异常检测"}
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            添加步骤
          </button>
        </div>
      </div>

      {anomalies.filter((a) => a.status === "open").length > 0 && (
        <div className="bg-anomaly-red-50 border border-anomaly-red-100 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-anomaly-red" />
            <span className="text-sm font-medium text-anomaly-red">发现 {anomalies.filter((a) => a.status === "open").length} 个异常</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {anomalies
              .filter((a) => a.status === "open")
              .map((a) => (
                <AnomalyBadge key={a.id} anomaly={a} />
              ))}
          </div>
        </div>
      )}

      {sortedSteps.length === 0 ? (
        <div className="text-center py-12 text-primary-300">
          <p>暂无修复步骤，点击"添加步骤"开始记录</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-primary-100" />
          <div className="space-y-4">
            {sortedSteps.map((step, index) => {
              const sAnomalies = stepAnomalies(step.id);
              const hasAnomaly = sAnomalies.some((a) => a.status === "open");

              return (
                <div key={step.id} className="relative flex gap-4">
                  <div className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        hasAnomaly
                          ? "bg-anomaly-red text-white"
                          : "bg-amber text-white"
                      }`}
                    >
                      {step.stepOrder}
                    </div>
                  </div>

                  <div className="flex-1 card p-4 ml-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeColorMap[step.type]}`}
                        >
                          {STEP_TYPE_LABELS[step.type]}
                        </span>
                        {hasAnomaly && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-anomaly-red-50 text-anomaly-red border border-anomaly-red-100">
                            <AlertCircle size={10} />
                            异常
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleReorder(index, "up")}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-ivory-200 text-primary-300 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => handleReorder(index, "down")}
                          disabled={index === sortedSteps.length - 1}
                          className="p-1 rounded hover:bg-ivory-200 text-primary-300 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-primary-800 font-medium">{step.description}</p>
                    {step.notes && (
                      <p className="text-sm text-primary-400 mt-1">{step.notes}</p>
                    )}
                    <p className="text-xs text-primary-300 mt-2">
                      执行时间：{new Date(step.performedAt).toLocaleDateString("zh-CN")}
                    </p>

                    {sAnomalies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {sAnomalies.map((a) => (
                          <AnomalyBadge key={a.id} anomaly={a} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="添加修复步骤">
        <div className="space-y-4">
          <div>
            <label className="label-field">步骤类型</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as RestorationStep["type"] })}
              className="input-field"
            >
              {Object.entries(STEP_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[80px]"
              placeholder="描述修复步骤内容"
            />
          </div>
          <div>
            <label className="label-field">备注</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field min-h-[60px]"
              placeholder="可选备注信息"
            />
          </div>
          <div>
            <label className="label-field">执行日期</label>
            <input
              type="date"
              value={form.performedAt}
              onChange={(e) => setForm({ ...form, performedAt: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">取消</button>
            <button onClick={handleAdd} className="btn-primary" disabled={!form.description}>
              添加
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
