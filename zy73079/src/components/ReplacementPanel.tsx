import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Wrench,
  ArrowRight,
  CalendarClock,
  User,
  FileWarning,
  Plus,
  Info,
} from 'lucide-react';
import { formatTime } from '../utils';

export default function ReplacementPanel() {
  const { replacements, addPartReplacement, inspections } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    partName: '',
    oldModel: '',
    newModel: '',
    quantity: 1,
    operator: '机修-张工',
    reason: '',
    dataImpactNote: '',
  });

  function handleSubmit() {
    if (!form.partName || !form.oldModel || !form.newModel) {
      alert('请填装备件名称和新旧型号');
      return;
    }
    const lastIds = inspections.slice(-3).map((i) => i.id);
    addPartReplacement({
      ...form,
      time: Date.now(),
      deviceId: inspections[0]?.deviceId || 'DP-Z03-刀盘A',
      relatedInspectionIds: lastIds,
    });
    setForm({
      partName: '', oldModel: '', newModel: '', quantity: 1,
      operator: '机修-张工', reason: '', dataImpactNote: '',
    });
    setShowForm(false);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
        <div>
          <h3 className="text-slate-100 font-semibold tracking-wide text-sm flex items-center gap-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <Wrench size={15} className="text-orange-400" />
            备件型号替换（单独拎出）
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            不混入正常巡检结果 · 共 {replacements.length} 条记录
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1.5 text-xs rounded bg-orange-500/15 text-orange-400 border border-orange-500/40 hover:bg-orange-500/25 transition flex items-center gap-1"
        >
          <Plus size={12} /> 新增替换
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {showForm && (
          <div className="rounded-lg border border-orange-500/40 bg-orange-500/5 p-3">
            <div className="text-xs text-orange-300 font-medium mb-2.5 flex items-center gap-1.5">
              <Plus size={12} /> 新增备件型号替换记录
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="备件名称（如：主驱动密封圈）"
                value={form.partName}
                onChange={(e) => setForm({ ...form, partName: e.target.value })}
                className="col-span-2 px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100"
              />
              <input
                placeholder="旧型号"
                value={form.oldModel}
                onChange={(e) => setForm({ ...form, oldModel: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100 font-mono"
              />
              <input
                placeholder="新型号"
                value={form.newModel}
                onChange={(e) => setForm({ ...form, newModel: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100 font-mono"
              />
              <input
                placeholder="操作人"
                value={form.operator}
                onChange={(e) => setForm({ ...form, operator: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100"
              />
              <input
                type="number"
                placeholder="数量"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className="px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100"
              />
              <input
                placeholder="替换原因"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="col-span-2 px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100"
              />
              <input
                placeholder="对后续数据的可能影响说明"
                value={form.dataImpactNote}
                onChange={(e) => setForm({ ...form, dataImpactNote: e.target.value })}
                className="col-span-2 px-2.5 py-1.5 text-xs rounded border border-slate-700 bg-slate-800 text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-xs rounded border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-3 py-1.5 text-xs rounded bg-orange-500 hover:bg-orange-600 text-white font-medium"
              >
                单独保存
              </button>
            </div>
          </div>
        )}

        {replacements.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            暂无备件替换记录
          </div>
        )}

        {replacements.map((rp) => (
          <div
            key={rp.id}
            className="relative rounded-lg border-2 border-orange-500/40 bg-slate-800/50 overflow-hidden"
          >
            <div className="absolute top-0 right-0">
              <span className="inline-block px-2 py-0.5 text-[10px] rounded-bl bg-orange-500 text-white font-semibold tracking-wider">
                ⚠ 备件替换
              </span>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-slate-100 font-semibold">{rp.partName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-300">
                    数量 ×{rp.quantity}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                  <span className="inline-flex items-center gap-0.5">
                    <CalendarClock size={10} /> {formatTime(rp.time)}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <User size={10} /> {rp.operator}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3 p-2 rounded bg-slate-900/60 border border-slate-700/60">
                <div className="flex-1">
                  <div className="text-[9px] text-slate-500 mb-0.5">旧型号</div>
                  <div className="font-mono text-xs text-slate-500 line-through">{rp.oldModel}</div>
                </div>
                <div className="p-1.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30">
                  <ArrowRight size={14} />
                </div>
                <div className="flex-1">
                  <div className="text-[9px] text-orange-400 mb-0.5">新型号</div>
                  <div className="font-mono text-xs text-orange-300">{rp.newModel}</div>
                </div>
              </div>

              {rp.reason && (
                <div className="mb-2">
                  <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1">
                    <FileWarning size={10} /> 替换原因
                  </div>
                  <div className="text-xs text-slate-300">{rp.reason}</div>
                </div>
              )}

              <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2">
                <div className="text-[10px] text-amber-400 mb-0.5 flex items-center gap-1 font-medium">
                  <Info size={10} /> 对数据的影响说明（排班同事重点关注）
                </div>
                <div className="text-xs text-amber-200 leading-relaxed">{rp.dataImpactNote}</div>
              </div>

              {rp.relatedInspectionIds.length > 0 && (
                <div className="mt-2 text-[10px] text-slate-500">
                  关联巡检记录：{rp.relatedInspectionIds.length} 条（不参与正常巡检统计）
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
