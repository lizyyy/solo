import { useState } from "react";
import { Plus, CheckCircle, XCircle, Link2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import type { RestorationStep } from "../../shared/types";

interface Props {
  restorationId: string;
}

const BATCH_PATTERN = /^[A-Z]{2}\d{8}$/;

export default function MaterialsPanel({ restorationId }: Props) {
  const { materials, steps, createMaterial, fetchMaterialUsage } = useStore();

  const [showAdd, setShowAdd] = useState(false);
  const [usageDetail, setUsageDetail] = useState<{ materialId: string; steps: RestorationStep[] } | null>(null);
  const [form, setForm] = useState({
    batchNumber: "",
    name: "",
    supplier: "",
    expiryDate: "",
    stepId: "",
  });

  const batchValid = BATCH_PATTERN.test(form.batchNumber);

  const handleAdd = async () => {
    try {
      await createMaterial(restorationId, form);
      setShowAdd(false);
      setForm({ batchNumber: "", name: "", supplier: "", expiryDate: "", stepId: "" });
    } catch {}
  };

  const handleUsageLookup = async (materialId: string) => {
    try {
      const usageSteps = await fetchMaterialUsage(materialId);
      setUsageDetail({ materialId, steps: usageSteps });
    } catch {}
  };

  const getStepName = (stepId: string) => {
    const step = steps.find((s) => s.id === stepId);
    return step ? `步骤${step.stepOrder} - ${step.description.slice(0, 20)}` : stepId;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-primary-800">材料批次</h3>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          添加材料
        </button>
      </div>

      {materials.length === 0 ? (
        <div className="text-center py-12 text-primary-300">
          <p>暂无材料记录</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary-100">
                <th className="text-left py-3 px-4 text-primary-400 font-medium">批号</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium">名称</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium">供应商</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium">有效期</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium">关联步骤</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium">状态</th>
                <th className="text-left py-3 px-4 text-primary-400 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className="border-b border-primary-50 hover:bg-ivory-200">
                  <td className="py-3 px-4 font-mono text-primary-800">{m.batchNumber}</td>
                  <td className="py-3 px-4 text-primary-700">{m.name}</td>
                  <td className="py-3 px-4 text-primary-600">{m.supplier}</td>
                  <td className="py-3 px-4 text-primary-600">
                    {new Date(m.expiryDate).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="py-3 px-4 text-primary-600 text-xs">
                    {getStepName(m.stepId)}
                  </td>
                  <td className="py-3 px-4"><StatusBadge status={m.status} /></td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleUsageLookup(m.id)}
                      className="flex items-center gap-1 text-amber hover:text-primary text-xs font-medium"
                    >
                      <Link2 size={12} />
                      反查
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {usageDetail && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-primary-800">
              材料使用反查
            </h4>
            <button onClick={() => setUsageDetail(null)} className="text-primary-400 hover:text-primary-600 text-xs">
              关闭
            </button>
          </div>
          {usageDetail.steps.length === 0 ? (
            <p className="text-xs text-primary-300">该材料未被任何步骤引用</p>
          ) : (
            <div className="space-y-2">
              {usageDetail.steps.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs text-primary-600">
                  <span className="w-6 h-6 rounded-full bg-amber-50 text-amber flex items-center justify-center font-bold">
                    {s.stepOrder}
                  </span>
                  <span>{s.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="添加材料">
        <div className="space-y-4">
          <div>
            <label className="label-field">批号</label>
            <div className="relative">
              <input
                type="text"
                value={form.batchNumber}
                onChange={(e) => setForm({ ...form, batchNumber: e.target.value.toUpperCase() })}
                className="input-field pr-10"
                placeholder="如：AB20240001"
              />
              {form.batchNumber && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {batchValid ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <XCircle size={16} className="text-anomaly-red" />
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-primary-300 mt-1">格式：2位大写字母 + 8位数字</p>
          </div>
          <div>
            <label className="label-field">材料名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="输入材料名称"
            />
          </div>
          <div>
            <label className="label-field">供应商</label>
            <input
              type="text"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              className="input-field"
              placeholder="输入供应商名称"
            />
          </div>
          <div>
            <label className="label-field">有效期</label>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">关联步骤</label>
            <select
              value={form.stepId}
              onChange={(e) => setForm({ ...form, stepId: e.target.value })}
              className="input-field"
            >
              <option value="">选择步骤</option>
              {steps.map((s) => (
                <option key={s.id} value={s.id}>
                  步骤{s.stepOrder} - {s.description.slice(0, 30)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">取消</button>
            <button
              onClick={handleAdd}
              className="btn-primary"
              disabled={!form.batchNumber || !form.name || !form.stepId}
            >
              添加
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
