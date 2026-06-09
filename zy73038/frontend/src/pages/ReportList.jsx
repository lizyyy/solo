import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, STATUS_LABELS } from '../api.js';

export default function ReportList({ summary }) {
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newAnimal, setNewAnimal] = useState({ name: '', type: '犬' });
  const [toast, setToast] = useState(null);

  const load = () => {
    api.getReports({ status, q }).then(setList).catch(e => setToast({ type: 'err', msg: e.message }));
  };
  useEffect(load, [status]);

  const handleCreate = async () => {
    if (!newAnimal.name.trim()) return setToast({ type: 'err', msg: '请填写动物名称' });
    try {
      const r = await api.createReport({ animal_name: newAnimal.name.trim(), animal_type: newAnimal.type });
      setToast({ type: 'ok', msg: `报告已创建：${r.case_no}` });
      setShowNew(false);
      setNewAnimal({ name: '', type: '犬' });
      setTimeout(() => nav(`/r/${r.id}`), 500);
    } catch (e) { setToast({ type: 'err', msg: e.message }); }
  };

  const statusFilters = [
    { key: 'all', text: '全部' },
    { key: 'draft', text: '草稿' },
    { key: 'pending', text: '待审核' },
    { key: 'suspended', text: '已挂起' },
    { key: 'approved', text: '已核准' },
    { key: 'rejected', text: '已驳回' },
  ];

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-2 rounded-md shadow-lg text-sm ${toast.type === 'ok' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
          <button className="ml-3 opacity-70 hover:opacity-100" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="card p-5">
        <div className="grid grid-cols-4 gap-4 mb-5">
          <StatCard label="报告总数" value={summary?.total || 0} color="text-gray-900" />
          <StatCard label="待审核" value={summary?.pending || 0} color="text-blue-600" />
          <StatCard label="已挂起" value={summary?.suspended || 0} color="text-amber-600" />
          <StatCard label="未解决异常" value={summary?.anomalies || 0} color="text-red-600" onClick={() => nav('/anomalies')} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map(f => (
              <button key={f.key} onClick={() => setStatus(f.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${status === f.key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {f.text}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <input className="input pl-8 w-64" placeholder="搜索 编号 / 动物名" value={q}
                onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>
            <button className="btn-secondary" onClick={load}>搜索</button>
            <button className="btn-primary" onClick={() => setShowNew(true)}>＋ 新建报告</button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium">编号</th>
              <th className="text-left px-4 py-3 font-medium">动物</th>
              <th className="text-left px-4 py-3 font-medium">状态</th>
              <th className="text-left px-4 py-3 font-medium">当前处理人</th>
              <th className="text-left px-4 py-3 font-medium">结论（摘要）</th>
              <th className="text-left px-4 py-3 font-medium">更新时间</th>
              <th className="text-right px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan="7" className="px-4 py-12 text-center text-gray-400">暂无数据，点击右上角新建报告</td></tr>
            )}
            {list.map(r => {
              const s = STATUS_LABELS[r.status] || {};
              return (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.case_no}</td>
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{r.animal_type === '犬' ? '🐶' : '🐱'}</span>
                      {r.animal_name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`tag ${s.cls || ''}`}>{s.text || r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.current_operator}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-md truncate" title={r.conclusion}>{r.conclusion || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{r.updated_at}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost text-brand-700 font-medium" onClick={() => nav(`/r/${r.id}`)}>查看详情 →</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center" onClick={() => setShowNew(false)}>
          <div className="card p-6 w-96" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">新建救助报告</h3>
            <div className="space-y-3">
              <div>
                <label className="label">动物名称</label>
                <input className="input" value={newAnimal.name} onChange={e => setNewAnimal({ ...newAnimal, name: e.target.value })}
                  placeholder="例如：小黄 / 花卷 / 大橘" autoFocus />
              </div>
              <div>
                <label className="label">类型</label>
                <select className="input" value={newAnimal.type} onChange={e => setNewAnimal({ ...newAnimal, type: e.target.value })}>
                  <option>犬</option><option>猫</option><option>其他</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setShowNew(false)}>取消</button>
              <button className="btn-primary" onClick={handleCreate}>创建并录入材料</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, onClick }) {
  return (
    <div className={`p-4 rounded-lg border border-gray-200 bg-gray-50 ${onClick ? 'cursor-pointer hover:bg-brand-50 hover:border-brand-300 transition' : ''}`} onClick={onClick}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
