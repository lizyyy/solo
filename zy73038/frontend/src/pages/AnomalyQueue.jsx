import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, ANOMALY_LABELS, STATUS_LABELS } from '../api.js';

export default function AnomalyQueue() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('0');
  const [typeFilter, setTypeFilter] = useState('all');
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

  const load = () => {
    api.getAnomalies({ resolved: filter === 'all' ? undefined : filter }).then(setList);
  };
  useEffect(load, [filter]);

  const notify = (t, m) => { setToast({ t, m }); setTimeout(() => setToast(null), 3000); };

  const handleResolve = async (a, resume = false) => {
    setBusy(a.id);
    try {
      await api.resolveAnomaly(a.id, { operator: '算法值班人', remark: '异常队列人工确认解决', resume_report: resume });
      notify('ok', `异常 #${a.id} 已解决` + (resume ? '，报告恢复待审核' : ''));
      load();
    } catch (e) { notify('err', e.message); }
    finally { setBusy(null); }
  };

  const filtered = typeFilter === 'all' ? list : list.filter(x => x.type === typeFilter);
  const unresolvedCount = list.filter(x => !x.resolved).length;

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-2 rounded-md shadow-lg text-sm ${toast.t === 'ok' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.m}
          <button className="ml-3 opacity-70 hover:opacity-100" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            ⚠️ 异常队列
            <span className="text-sm font-normal text-gray-500">（系统自动触发 + 人工标记，和报告状态双向联动）</span>
          </h2>
          <div className="text-sm text-gray-600">
            未解决 <b className={unresolvedCount > 0 ? 'text-red-600' : 'text-gray-700'}>{unresolvedCount}</b>
            {' / 共 '}<b>{list.length}</b> 条
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-md">
            {[
              { k: '0', t: '未解决' },
              { k: '1', t: '已解决' },
              { k: 'all', t: '全部' },
            ].map(b => (
              <button key={b.k} onClick={() => setFilter(b.k)}
                className={`px-3 py-1 rounded text-sm font-medium transition ${filter === b.k ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}>
                {b.t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setTypeFilter('all')}
              className={`tag ${typeFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>全部类型</button>
            {Object.entries(ANOMALY_LABELS).map(([k, L]) => (
              <button key={k} onClick={() => setTypeFilter(k)}
                className={`tag ${typeFilter === k ? 'bg-gray-700 text-white' : L.cls + ' hover:opacity-80'}`}>{L.text}</button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-5">
          <b>🔔 值班人看这里：</b>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li><b className="text-amber-800">用药剂量变更</b> —— 后端自动检测同一病历下相同药品不同剂量，自动挂起报告并列出牵动的 4 项结论</li>
            <li><b className="text-amber-800">材料标题/明细冲突</b> —— 老周录入时手动标注的"标题对不上"的条目</li>
            <li><b className="text-amber-800">新旧信息冲突</b> —— 同标题材料 v1 → v2 被系统自动识别为口径变更</li>
            <li>点「解决并恢复报告」会把报告从 <span className="tag bg-amber-100 text-amber-700">已挂起</span> 打回 <span className="tag bg-blue-100 text-blue-700">待审核</span>，历史会记录操作人</li>
            <li>所有写操作真实落库 SQLite，重启服务/页面后不丢</li>
          </ol>
        </div>

        {filtered.length === 0 && <div className="text-center py-12 text-gray-400">🎉 当前无异常</div>}
        <div className="space-y-3">
          {filtered.map(a => {
            const L = ANOMALY_LABELS[a.type] || {};
            const RS = STATUS_LABELS[a.report_status] || {};
            return (
              <div key={a.id} className={`rounded-lg border p-4 transition ${a.resolved ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-gray-200 hover:border-amber-300'}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`tag ${a.resolved ? 'bg-gray-300 text-gray-700' : L.cls}`}>
                        {a.resolved ? '已解决' : L.text || a.type}
                      </span>
                      <span className="text-xs font-mono text-gray-500">#{a.id}</span>
                      <span className="text-xs text-gray-500">创建 {a.created_at}</span>
                      {a.resolved_at && <span className="text-xs text-gray-500">· 解决 {a.resolved_at}</span>}
                      <Link to={`/r/${a.report_id}`} className="ml-auto text-xs text-brand-700 font-medium hover:underline flex items-center gap-1">
                        跳转到报告 <b>{a.case_no}</b>（{a.animal_name}） <span className={`tag ${RS.cls}`}>{RS.text || a.report_status}</span> →
                      </Link>
                    </div>
                    <div className="text-sm text-gray-800 leading-relaxed mb-2">{a.description}</div>
                    {a.affected_conclusions?.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-500">牵动结论：</span>
                        {a.affected_conclusions.map((c, i) => (
                          <span key={i} className={`px-2 py-0.5 rounded ${a.type === 'dosage_changed' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {!a.resolved && (
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <button className="btn-secondary text-xs" disabled={busy === a.id} onClick={() => handleResolve(a, false)}>
                        ✓ 仅标记解决
                      </button>
                      {a.report_status === 'suspended' && (
                        <button className="btn-primary text-xs" disabled={busy === a.id} onClick={() => handleResolve(a, true)}>
                          ✓ 解决 + 恢复报告
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
