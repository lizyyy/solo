import { useState } from "react";
import { useStore, type Trade } from "@/store";
import { Plus, Edit2, Trash2 } from "lucide-react";

const emptyForm = {
  direction: "正回购",
  counterparty: "",
  amount: 0,
  term: 1,
  startDate: "",
  endDate: "",
  source: "",
};

export default function TradeTab() {
  const { trades, createTrade, updateTrade, deleteTrade, currentBatchId } = useStore();
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
      await updateTrade(currentBatchId, editingId, form);
    } else {
      await createTrade(currentBatchId, form);
    }
    resetForm();
  };

  const handleEdit = (trade: Trade) => {
    setForm({
      direction: trade.direction,
      counterparty: trade.counterparty,
      amount: trade.amount,
      term: trade.term,
      startDate: trade.startDate,
      endDate: trade.endDate,
      source: trade.source,
    });
    setEditingId(trade.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!currentBatchId) return;
    await deleteTrade(currentBatchId, id);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-md bg-brand-info px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-400"
        >
          <Plus size={16} />
          添加交易
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-slate-700 bg-brand-card p-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">方向</label>
              <select
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value })}
                className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary"
              >
                <option value="正回购">正回购</option>
                <option value="逆回购">逆回购</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">对手方</label>
              <input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">金额(万)</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">期限(天)</label>
              <input type="number" value={form.term} onChange={(e) => setForm({ ...form, term: Number(e.target.value) })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">起息日</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-text-secondary">到期日</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-brand-text-primary outline-none focus:border-brand-warning" />
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
              <th>方向</th>
              <th>对手方</th>
              <th>金额(万)</th>
              <th>期限(天)</th>
              <th>起息日</th>
              <th>到期日</th>
              <th>来源</th>
              <th>版本</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr><td colSpan={9} className="py-8 text-center text-brand-text-secondary">暂无交易记录</td></tr>
            ) : trades.map((t) => (
              <tr key={t.id}>
                <td>{t.direction}</td>
                <td>{t.counterparty}</td>
                <td>{t.amount.toLocaleString()}</td>
                <td>{t.term}</td>
                <td>{t.startDate}</td>
                <td>{t.endDate}</td>
                <td>{t.source || "-"}</td>
                <td>v{t.version}</td>
                <td>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(t)} className="text-brand-text-secondary hover:text-brand-warning"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(t.id)} className="text-brand-text-secondary hover:text-brand-danger"><Trash2 size={14} /></button>
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
