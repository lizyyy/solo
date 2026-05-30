import { useState } from "react";
import { useStore, type Collateral } from "@/store";
import { Plus, Edit2, Trash2 } from "lucide-react";

const emptyForm = {
  tradeId: "",
  bondCode: "",
  bondName: "",
  faceValue: 0,
  quantity: 0,
  maturityDate: "",
  replacementBondCode: "",
  replacementStatus: "无替换",
  source: "",
};

export default function CollateralTab() {
  const { collaterals, trades, createCollateral, updateCollateral, deleteCollateral, currentBatchId } = useStore();
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
    const payload = {
      ...form,
      replacementBondCode: form.replacementBondCode || undefined,
    };
    if (editingId) {
      await updateCollateral(currentBatchId, editingId, payload);
    } else {
      await createCollateral(currentBatchId, payload);
    }
    resetForm();
  };

  const handleEdit = (c: Collateral) => {
    setForm({
      tradeId: c.tradeId,
      bondCode: c.bondCode,
      bondName: c.bondName,
      faceValue: c.faceValue,
      quantity: c.quantity,
      maturityDate: c.maturityDate,
      replacementBondCode: c.replacementBondCode || "",
      replacementStatus: c.replacementStatus,
      source: c.source,
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!currentBatchId) return;
    await deleteCollateral(currentBatchId, id);
  };

  const getTradeLabel = (tradeId: string) => {
    const t = trades.find((tr) => tr.id === tradeId);
    return t ? `${t.direction} - ${t.counterparty}` : tradeId.slice(0, 8);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-md bg-brand-info px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-400"
        >
          <Plus size={16} />
          添加质押券
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-brand-card p-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">关联交易</label>
              <select value={form.tradeId} onChange={(e) => setForm({ ...form, tradeId: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary">
                <option value="">选择交易</option>
                {trades.map((t) => (
                  <option key={t.id} value={t.id}>{t.direction} - {t.counterparty}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">债券代码</label>
              <input value={form.bondCode} onChange={(e) => setForm({ ...form, bondCode: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">债券名称</label>
              <input value={form.bondName} onChange={(e) => setForm({ ...form, bondName: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">面值</label>
              <input type="number" value={form.faceValue} onChange={(e) => setForm({ ...form, faceValue: Number(e.target.value) })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">数量</label>
              <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">到期日</label>
              <input type="date" value={form.maturityDate} onChange={(e) => setForm({ ...form, maturityDate: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">替换债券代码</label>
              <input value={form.replacementBondCode} onChange={(e) => setForm({ ...form, replacementBondCode: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">替换状态</label>
              <select value={form.replacementStatus} onChange={(e) => setForm({ ...form, replacementStatus: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary">
                <option value="无替换">无替换</option>
                <option value="待替换">待替换</option>
                <option value="已替换">已替换</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">来源</label>
              <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div className="flex items-end gap-2">
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
              <th>关联交易</th>
              <th>债券代码</th>
              <th>债券名称</th>
              <th>面值</th>
              <th>数量</th>
              <th>到期日</th>
              <th>替换状态</th>
              <th>来源</th>
              <th>版本</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {collaterals.length === 0 ? (
              <tr><td colSpan={10} className="py-8 text-center text-brand-text-secondary">暂无质押券记录</td></tr>
            ) : collaterals.map((c) => (
              <tr key={c.id}>
                <td>{getTradeLabel(c.tradeId)}</td>
                <td>{c.bondCode}</td>
                <td>{c.bondName}</td>
                <td>{c.faceValue.toLocaleString()}</td>
                <td>{c.quantity.toLocaleString()}</td>
                <td>{c.maturityDate}</td>
                <td>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    c.replacementStatus === "已替换" ? "bg-emerald-600/30 text-emerald-400" :
                    c.replacementStatus === "待替换" ? "bg-amber-600/30 text-amber-400" :
                    "bg-slate-600 text-slate-300"
                  )}>{c.replacementStatus}</span>
                </td>
                <td>{c.source || "-"}</td>
                <td>v{c.version}</td>
                <td>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(c)} className="text-brand-text-secondary hover:text-brand-warning"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(c.id)} className="text-brand-text-secondary hover:text-brand-danger"><Trash2 size={14} /></button>
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
