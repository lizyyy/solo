import { useState } from "react";
import { useStore, type DiscountRate } from "@/store";
import { Plus, Edit2, Trash2 } from "lucide-react";

const emptyForm = {
  bondCode: "",
  rate: 0,
  effectiveDate: "",
  expiryDate: "",
  source: "",
};

export default function RateTab() {
  const { rates, createRate, updateRate, deleteRate, currentBatchId } = useStore();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!currentBatchId) return;
    if (editingId) {
      await updateRate(currentBatchId, editingId, form);
    } else {
      await createRate(currentBatchId, form);
    }
    resetForm();
  };

  const handleEdit = (r: DiscountRate) => {
    setForm({
      bondCode: r.bondCode,
      rate: r.rate,
      effectiveDate: r.effectiveDate,
      expiryDate: r.expiryDate,
      source: r.source,
    });
    setEditingId(r.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!currentBatchId) return;
    await deleteRate(currentBatchId, id);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-md bg-brand-info px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-400"
        >
          <Plus size={16} />
          添加折算率
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-brand-card p-4">
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">债券代码</label>
              <input value={form.bondCode} onChange={(e) => setForm({ ...form, bondCode: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">折算率(%)</label>
              <input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">生效日</label>
              <input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">到期日</label>
              <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-brand-text-secondary">来源</label>
                <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
              </div>
              <button onClick={handleSubmit} className="rounded-md bg-brand-success px-3 py-1.5 text-sm text-white hover:bg-emerald-400">{editingId ? "保存" : "添加"}</button>
              <button onClick={resetForm} className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-brand-text-secondary hover:text-brand-text-primary">取消</button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="data-table">
          <thead className="bg-slate-800">
            <tr>
              <th>债券代码</th>
              <th>折算率(%)</th>
              <th>生效日</th>
              <th>到期日</th>
              <th>来源</th>
              <th>版本</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-brand-text-secondary">暂无折算率记录</td></tr>
            ) : rates.map((r) => (
              <tr key={r.id}>
                <td>{r.bondCode}</td>
                <td>{r.rate.toFixed(2)}</td>
                <td>{r.effectiveDate}</td>
                <td>
                  <span className={isExpired(r.expiryDate) ? "text-brand-danger" : ""}>
                    {r.expiryDate}
                  </span>
                </td>
                <td>{r.source || "-"}</td>
                <td>v{r.version}</td>
                <td>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(r)} className="text-brand-text-secondary hover:text-brand-warning"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(r.id)} className="text-brand-text-secondary hover:text-brand-danger"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isExpired(dateStr: string) {
  return dateStr < new Date().toISOString().slice(0, 10);
}
