
import { useMemo, useState } from 'react';
import { useWorkOrderStore } from '../store/workOrderStore';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { Filter, History as HistoryIcon, Calendar, User, Shield } from 'lucide-react';
import { SHIFT_LABELS, JUDGMENT_LABELS } from '../types';
import type { Shift } from '../types';

export default function JudgmentHistory() {
  const { workOrders, selectOrder } = useWorkOrderStore();
  const [filterShift, setFilterShift] = useState<Shift | 'all'>('all');
  const [filterRole, setFilterRole] = useState<'all' | 'supervisor' | 'reviewer'>('all');
  const [onlyModified, setOnlyModified] = useState(true);

  const allRecords = useMemo(() => {
    const list: any[] = [];
    for (const o of workOrders) {
      for (const r of o.judgmentHistory) {
        list.push({ ...r, orderNo: o.orderNo, deviceName: o.deviceName, deviceNo: o.deviceNo });
      }
    }
    return list.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  }, [workOrders]);

  const filtered = useMemo(() => {
    return allRecords.filter(r => {
      if (filterShift !== 'all' && r.shift !== filterShift) return false;
      if (filterRole !== 'all' && r.operatorRole !== filterRole) return false;
      return true;
    });
  }, [allRecords, filterShift, filterRole]);

  const ordersWithHistory = useMemo(() => {
    const list = workOrders
      .filter(o => o.judgmentHistory.length >= (onlyModified ? 2 : 1))
      .sort((a, b) => b.judgmentHistory.length - a.judgmentHistory.length);
    return list;
  }, [workOrders, onlyModified]);

  const supervisorModifications = allRecords.filter(r => r.operatorRole === 'supervisor').length;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 md:px-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-lg bg-white/15">
              <HistoryIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wide">判断历史时间链</h1>
              <p className="text-white/80 text-sm mt-0.5">
                维保主管阿敏每次修改判断时都会记录原因，下一班次可清楚看到每个最终值"怎么来的"
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {([
              { label: '历史总记录', val: allRecords.length, sub: '条' },
              { label: '主管修改（含原因）', val: supervisorModifications, sub: '次', accent: true },
              { label: '涉及工单', val: ordersWithHistory.length, sub: '个' },
              { label: '跨班次修改', val: new Set(allRecords.map(r => r.shift)).size, sub: '个班次' },
            ]).map((s, i) => (
              <div key={i} className={`rounded-lg px-4 py-3 ${s.accent ? 'bg-white/20 border border-white/30' : 'bg-white/10'}`}>
                <div className="text-[11px] text-white/80 mb-0.5">{s.label}</div>
                <div className="text-2xl font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {s.val}<span className="text-sm font-normal ml-1 opacity-80">{s.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-4">
          <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Filter className="w-4 h-4" /> 筛选时间链
          </div>
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value as Shift | 'all')}
            className="text-xs rounded border border-slate-300 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">全部班次</option>
            {Object.entries(SHIFT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="text-xs rounded border border-slate-300 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">全部角色</option>
            <option value="supervisor">仅维保主管（含原因）</option>
            <option value="reviewer">仅审核员</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyModified}
              onChange={(e) => setOnlyModified(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
            />
            只显示被修改过（判断变更≥2次）的工单
          </label>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1 space-y-3">
            <div className="text-sm font-semibold text-slate-700 px-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> 按工单分组（{ordersWithHistory.length}）
            </div>
            {ordersWithHistory.length === 0 && (
              <div className="text-center text-slate-400 py-10 text-sm bg-white rounded-lg border border-slate-200">
                暂无符合条件的工单
              </div>
            )}
            {ordersWithHistory.slice(0, 12).map(o => (
              <button
                key={o.id}
                onClick={() => selectOrder(o.id)}
                className="w-full text-left bg-white border border-slate-200 rounded-lg p-3.5 hover:border-indigo-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="font-mono text-[11px] text-slate-500">{o.orderNo}</div>
                    <div className="text-sm font-semibold text-slate-800 truncate max-w-[220px]">{o.deviceName}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                    修改 {o.judgmentHistory.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500 flex-wrap">
                  {[...new Set(o.judgmentHistory.map(r => SHIFT_LABELS[r.shift]))].map(s => (
                    <span key={s} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">{s}</span>
                  ))}
                  {o.judgmentHistory.some(r => r.operatorRole === 'supervisor') && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <Shield className="w-2.5 h-2.5" />主管介入
                    </span>
                  )}
                  <span className="ml-auto">
                    当前：<span className="font-semibold text-slate-700">{JUDGMENT_LABELS[o.judgment]}</span>
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-0.5"><User className="w-2.5 h-2.5" />{o.judgmentHistory[o.judgmentHistory.length - 1].operator}</span>
                  <span>{o.judgmentHistory[o.judgmentHistory.length - 1].changedAt.slice(5, 16)}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-3">
            <div className="text-sm font-semibold text-slate-700 px-1 flex items-center gap-1.5">
              <HistoryIcon className="w-4 h-4" /> 全局时间链（最近操作在上）共 {filtered.length} 条
            </div>
            {filtered.length === 0 && (
              <div className="text-center text-slate-400 py-10 text-sm bg-white rounded-lg border border-slate-200">
                当前筛选条件下无记录
              </div>
            )}
            {filtered.slice(0, 30).map((r, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className={`px-4 py-2 flex items-center justify-between text-[11px] ${
                  r.operatorRole === 'supervisor' ? 'bg-indigo-50 border-b border-indigo-100 text-indigo-700' : 'bg-slate-50 border-b border-slate-100 text-slate-600'
                }`}>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="font-mono">{r.orderNo}</span>
                    <span className="opacity-70">·</span>
                    <span className="truncate max-w-[220px]">{r.deviceName}</span>
                    <span className="opacity-70">·</span>
                    <span>{SHIFT_LABELS[r.shift]}</span>
                  </div>
                  <span className="inline-flex items-center gap-1">
                    {r.operatorRole === 'supervisor' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {r.operator} · {r.changedAt.slice(5, 16)}
                  </span>
                </div>
                <div className="p-4">
                  <HistoryTimeline records={[r]} compact />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
