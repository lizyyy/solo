import { Plus, Lock, Unlock, ArrowRight, Trash2, Edit3, Check, X } from "lucide-react";
import { useReviewStore } from "@/store/reviewStore";
import { useState } from "react";
import type { FieldMapping } from "@/types";

const SYSTEM_FIELD_OPTIONS = [
  "unifiedDeviceId",
  "source",
  "status",
  "remark",
  "conclusionFile",
  "bladeAngle",
  "vibrationLevel",
];

const SOURCE_OPTIONS = [
  "所有清单",
  "备件清单A",
  "巡检表B",
  "月度汇总C",
  "现场报告D",
  "供应商清单E",
  "通用",
];

export default function FieldMappingTable() {
  const { fieldMappings, addFieldMapping, removeFieldMapping, updateFieldMapping } =
    useReviewStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    spareFieldName: "",
    systemFieldName: SYSTEM_FIELD_OPTIONS[0],
    source: SOURCE_OPTIONS[0],
    isProtected: false,
  });

  const resetForm = () => {
    setForm({
      spareFieldName: "",
      systemFieldName: SYSTEM_FIELD_OPTIONS[0],
      source: SOURCE_OPTIONS[0],
      isProtected: false,
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!form.spareFieldName.trim()) return;
    if (editingId) {
      updateFieldMapping(editingId, form);
    } else {
      addFieldMapping(form);
    }
    resetForm();
  };

  const startEdit = (m: FieldMapping) => {
    setEditingId(m.id);
    setForm({
      spareFieldName: m.spareFieldName,
      systemFieldName: m.systemFieldName,
      source: m.source,
      isProtected: m.isProtected,
    });
    setShowForm(true);
  };

  const protectedCount = fieldMappings.filter((m) => m.isProtected).length;

  return (
    <div className="space-y-4">
      <div className="card-surface p-5 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-industrial-800 mb-1">
              备件字段 → 系统字段 映射规则
            </h3>
            <p className="text-sm text-gray-500">
              复核人提交的备件清单字段名可能前后不一，至少将来源和处理状态设为受保护（🔒 不可删除）
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              共 {fieldMappings.length} 条规则 · {protectedCount} 条受保护
            </span>
            <button
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
              className="btn-industrial inline-flex items-center gap-1.5"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>新增映射</span>
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-5 bg-industrial-50/60 border border-industrial-200 rounded-industrial p-4 animate-fade-in">
            <p className="text-sm font-semibold text-industrial-700 mb-3">
              {editingId ? "编辑映射规则" : "新增映射规则"}
            </p>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  备件原始字段名
                </label>
                <input
                  type="text"
                  value={form.spareFieldName}
                  onChange={(e) => setForm({ ...form, spareFieldName: e.target.value })}
                  placeholder="如：设备编号"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  → 系统字段
                </label>
                <select
                  value={form.systemFieldName}
                  onChange={(e) => setForm({ ...form, systemFieldName: e.target.value })}
                  className="input-field"
                >
                  {SYSTEM_FIELD_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">来源</label>
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="input-field"
                >
                  {SOURCE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex-1 inline-flex items-center gap-2 px-3 py-2 border rounded-industrial cursor-pointer transition-all h-[38px]">
                  <input
                    type="checkbox"
                    checked={form.isProtected}
                    onChange={(e) => setForm({ ...form, isProtected: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    受保护🔒（保来源/状态）
                  </span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={resetForm} className="btn-outline">
                <span className="inline-flex items-center gap-1">
                  <X size={14} strokeWidth={2.5} />
                  取消
                </span>
              </button>
              <button onClick={handleSubmit} className="btn-success">
                <span className="inline-flex items-center gap-1">
                  <Check size={14} strokeWidth={2.5} />
                  {editingId ? "保存修改" : "添加规则"}
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="border border-gray-200 rounded-industrial overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted">
                <th className="table-header-cell w-12">#</th>
                <th className="table-header-cell w-14">状态</th>
                <th className="table-header-cell">备件字段名</th>
                <th className="table-header-cell w-14 text-center">映射</th>
                <th className="table-header-cell">系统字段名</th>
                <th className="table-header-cell">适用来源</th>
                <th className="table-header-cell w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {fieldMappings.map((m, i) => (
                <tr
                  key={m.id}
                  className={`border-t border-gray-100 transition-colors ${
                    m.isProtected ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="table-cell text-gray-400 font-mono text-xs">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="table-cell">
                    {m.isProtected ? (
                      <Lock
                        size={15}
                        className="text-amber-600"
                        strokeWidth={2}
                      />
                    ) : (
                      <Unlock size={15} className="text-gray-400" strokeWidth={2} />
                    )}
                  </td>
                  <td className="table-cell">
                    <span className="font-serif italic text-gray-600">
                      {m.spareFieldName}
                    </span>
                  </td>
                  <td className="table-cell text-center text-gray-300">
                    <ArrowRight size={16} strokeWidth={2} />
                  </td>
                  <td className="table-cell">
                    <span className="font-mono font-semibold text-industrial-700">
                      {m.systemFieldName}
                    </span>
                  </td>
                  <td className="table-cell text-gray-600 text-xs">{m.source}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(m)}
                        className="p-1.5 rounded-industrial text-gray-500 hover:bg-industrial-100 hover:text-industrial-600 transition-colors"
                        title="编辑"
                      >
                        <Edit3 size={14} strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => removeFieldMapping(m.id)}
                        disabled={m.isProtected}
                        className={`p-1.5 rounded-industrial transition-colors ${
                          m.isProtected
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-gray-500 hover:bg-red-50 hover:text-red-600"
                        }`}
                        title={m.isProtected ? "受保护字段，不可删除" : "删除"}
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-industrial text-xs text-amber-800">
          <span className="font-semibold">🔒 受保护字段说明：</span>
          即使服务重启，映射为 source（来源）和 status（处理状态）的规则会被保住，不会被误删。
          当前被标记为受保护的字段：
          {fieldMappings
            .filter((m) => m.isProtected)
            .map((m) => m.spareFieldName)
            .join("、")}
        </div>
      </div>
    </div>
  );
}
