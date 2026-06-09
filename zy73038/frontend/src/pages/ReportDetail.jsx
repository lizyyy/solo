import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, STATUS_LABELS, MATERIAL_LABELS, ANOMALY_LABELS } from '../api.js';

export default function ReportDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [toast, setToast] = useState(null);
  const [showAddMat, setShowAddMat] = useState(false);
  const [showVerdict, setShowVerdict] = useState(false);
  const [newMat, setNewMat] = useState({ type: 'handwritten', title: '', content: '', source: '寄养店长老周', medications: [{ drug_name: '', dosage: '' }] });
  const [verdict, setVerdict] = useState({ conclusion: '', operator: '寄养店长老周', reason: '', remark: '' });
  const [exported, setExported] = useState(null);

  const load = () => {
    api.getReport(id).then(d => {
      setData(d);
      if (!verdict.conclusion && d.report.conclusion) setVerdict(v => ({ ...v, conclusion: d.report.conclusion }));
    }).catch(e => setToast({ type: 'err', msg: e.message }));
  };
  useEffect(load, [id]);

  const notify = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const groupedMaterials = () => {
    if (!data) return [];
    const m = {};
    for (const mat of data.materials) {
      if (!m[mat.title]) m[mat.title] = [];
      m[mat.title].push(mat);
    }
    return Object.entries(m).map(([t, arr]) => ({
      title: t,
      items: arr.sort((a, b) => a.version - b.version),
      latest: arr.sort((a, b) => b.version - a.version)[0],
      hasConflict: arr.some(x => !x.is_original)
    }));
  };

  const addMedication = () => setNewMat(m => ({ ...m, medications: [...m.medications, { drug_name: '', dosage: '' }] }));
  const removeMedication = (i) => setNewMat(m => ({ ...m, medications: m.medications.filter((_, j) => j !== i) }));
  const updateMedication = (i, k, v) => setNewMat(m => ({
    ...m, medications: m.medications.map((med, j) => j === i ? { ...med, [k]: v } : med)
  }));

  const submitMaterial = async () => {
    if (!newMat.title.trim() || !newMat.content.trim()) return notify('err', '标题和内容必填');
    const meds = newMat.medications.filter(m => m.drug_name.trim() && m.dosage.trim());
    try {
      const r = await api.addMaterial(id, { ...newMat, medications: meds });
      notify('ok', `材料已提交，v${r.version}` + (r.suspended ? '，⚠️ 用药剂量变更已触发挂起' : ''));
      setShowAddMat(false);
      setNewMat({ type: 'handwritten', title: '', content: '', source: '寄养店长老周', medications: [{ drug_name: '', dosage: '' }] });
      load();
    } catch (e) { notify('err', e.message); }
  };

  const submitVerdict = async () => {
    if (!verdict.conclusion.trim()) return notify('err', '结论必填');
    try {
      await api.setVerdict(id, verdict);
      notify('ok', '改判已提交，状态回到待审核');
      setShowVerdict(false);
      load();
    } catch (e) { notify('err', e.message); }
  };

  const changeStatus = async (status, reason = '') => {
    try {
      await api.setStatus(id, { status, operator: '算法值班人', reason });
      notify('ok', `状态已改为：${STATUS_LABELS[status]?.text || status}`);
      load();
    } catch (e) { notify('err', e.message); }
  };

  const doExport = async () => {
    try {
      const r = await api.exportReport(id);
      setExported(r);
      load();
    } catch (e) { notify('err', e.message); }
  };

  const unresolvedAnomalies = (data?.anomalies || []).filter(a => !a.resolved);
  const medMapByMaterial = {};
  (data?.medications || []).forEach(m => {
    if (!medMapByMaterial[m.material_id]) medMapByMaterial[m.material_id] = [];
    medMapByMaterial[m.material_id].push(m);
  });

  if (!data) return <div className="text-center py-20 text-gray-400">加载中…</div>;

  const rep = data.report;
  const s = STATUS_LABELS[rep.status] || {};

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-2 rounded-md shadow-lg text-sm ${toast.type === 'ok' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
          <button className="ml-3 opacity-70 hover:opacity-100" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm">← 返回列表</Link>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{rep.case_no}</span>
              <span className={`tag ${s.cls || ''}`}>{s.text || rep.status}</span>
              {unresolvedAnomalies.length > 0 && (
                <span className="tag bg-red-100 text-red-700">⚠️ {unresolvedAnomalies.length} 个未解决异常</span>
              )}
            </div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              {rep.animal_type === '犬' ? '🐶' : '🐱'} {rep.animal_name}
            </h2>
            <div className="text-xs text-gray-500 mt-1">
              创建 {rep.created_at} · 更新 {rep.updated_at} · 当前处理人：<span className="font-medium text-gray-700">{rep.current_operator}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => setShowVerdict(true)}>✏️ 改判结论</button>
            <button className="btn-secondary" onClick={() => setShowAddMat(true)}>📎 放新材料</button>
            {rep.status === 'suspended'
              ? <button className="btn-warning" onClick={() => changeStatus('pending', '人工确认异常，恢复处理')}>↻ 解除挂起</button>
              : <button className="btn-ghost" onClick={() => changeStatus('suspended', '手动挂起')}>⏸ 挂起</button>}
            {rep.status === 'pending' && (
              <>
                <button className="btn-primary" onClick={() => changeStatus('approved', '审核通过')}>✓ 核准</button>
                <button className="btn-danger" onClick={() => changeStatus('rejected', '驳回处理')}>✗ 驳回</button>
              </>
            )}
            <button className="btn-primary" onClick={doExport} disabled={rep.status === 'suspended' || unresolvedAnomalies.length > 0}>
              📤 导出报告
            </button>
          </div>
        </div>

        <div className="mt-5 p-4 bg-brand-50 rounded-lg border border-brand-200">
          <div className="text-xs font-medium text-brand-700 mb-1">当前结论</div>
          <div className="text-gray-800 whitespace-pre-wrap">{rep.conclusion || <span className="text-gray-400">（暂未填写，点击右上角"改判结论"）</span>}</div>
        </div>
      </div>

      {unresolvedAnomalies.length > 0 && (
        <div className="card p-5 border-amber-300 bg-amber-50">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <span>⚠️</span> 与异常队列联动的问题（{unresolvedAnomalies.length} 条待处理）
            <Link to="/anomalies" className="ml-auto text-sm font-normal text-amber-700 hover:underline">去异常队列批量处理 →</Link>
          </h3>
          <div className="space-y-3">
            {unresolvedAnomalies.map(a => {
              const L = ANOMALY_LABELS[a.type] || {};
              return (
                <div key={a.id} className="bg-white rounded-md border border-amber-200 p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`tag ${L.cls || ''}`}>{L.text || a.type}</span>
                        <span className="text-xs text-gray-500">#{a.id} · {a.created_at}</span>
                      </div>
                      <div className="text-sm text-gray-800">{a.description}</div>
                      {a.affected_conclusions?.length > 0 && (
                        <div className="mt-2 text-xs">
                          <span className="text-gray-500">牵动结论：</span>
                          {a.affected_conclusions.map((c, i) => (
                            <span key={i} className="ml-1 inline-block bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="btn-ghost text-brand-700"
                      onClick={async () => {
                        await api.resolveAnomaly(a.id, { operator: '算法值班人', remark: '详情页标记解决', resume_report: true });
                        notify('ok', '异常已解决，报告恢复待审核');
                        load();
                      }}>标记解决</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">📎 材料区 <span className="text-xs text-gray-500 font-normal ml-2">（同标题的多版本按时间展开，口径变更会高亮）</span></h3>
              <button className="btn-secondary text-xs" onClick={() => setShowAddMat(true)}>＋ 补充材料</button>
            </div>
            {groupedMaterials().length === 0 && <div className="text-center py-8 text-gray-400">暂无材料</div>}
            <div className="space-y-5">
              {groupedMaterials().map(group => (
                <div key={group.title} className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className={`px-4 py-2.5 flex items-center justify-between ${group.hasConflict ? 'bg-rose-50 border-b border-rose-200' : 'bg-gray-50 border-b border-gray-200'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`tag ${MATERIAL_LABELS[group.latest.type]?.cls || ''}`}>{MATERIAL_LABELS[group.latest.type]?.text || group.latest.type}</span>
                      <span className="font-medium">{group.title}</span>
                      {group.hasConflict && <span className="tag bg-rose-200 text-rose-800">⚠️ 口径改过 {group.items.length - 1} 次</span>}
                    </div>
                    <div className="text-xs text-gray-500">共 {group.items.length} 版 · 最新 v{group.latest.version} · 来源 {group.latest.source}</div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {group.items.map((m, idx) => {
                      const isLatest = idx === group.items.length - 1;
                      const meds = medMapByMaterial[m.id] || [];
                      return (
                        <div key={m.id} className={`p-4 ${!isLatest ? 'bg-gray-50/60' : ''} ${!m.is_original ? 'border-l-4 border-rose-400 pl-3' : ''}`}>
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className={`tag ${m.is_original ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>v{m.version} {m.is_original ? '原始' : '口径变更'}</span>
                              <span className="text-gray-500">{m.source} · {m.created_at}</span>
                              {!m.is_original && (
                                <span className="text-rose-600">较 v{m.version - 1} 有改动</span>
                              )}
                            </div>
                            {isLatest && <span className="tag bg-brand-100 text-brand-700">当前采用</span>}
                          </div>
                          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{m.content}</div>
                          {meds.length > 0 && (
                            <div className="mt-3 p-3 bg-purple-50 rounded-md border border-purple-100">
                              <div className="text-xs text-purple-700 font-medium mb-1.5">💊 用药记录（{meds.length} 项）</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {meds.map(me => (
                                  <div key={me.id} className="flex justify-between bg-white rounded px-2.5 py-1.5 border border-purple-100">
                                    <span className="text-gray-700 font-medium">{me.drug_name}</span>
                                    <span className="text-gray-600 font-mono">{me.dosage}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-lg mb-4">🕒 历史 <span className="text-xs text-gray-500 font-normal ml-2">（能看到旧结论、新备注和改判原因，重启后仍在）</span></h3>
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200"></div>
              {data.histories.length === 0 && <div className="text-gray-400 py-4">暂无历史</div>}
              {data.histories.map((h, i) => (
                <div key={h.id} className="relative mb-4 last:mb-0">
                  <div className={`absolute -left-4 top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${h.action.includes('conclusion') ? 'bg-brand-500' : h.action.includes('suspend') || h.action.includes('anomaly') ? 'bg-amber-500' : h.action.includes('status_') ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                  <div className="bg-gray-50 rounded-md p-3">
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mb-1.5">
                      <span className="font-medium text-gray-700">{h.operator}</span>
                      <span>·</span>
                      <span>{h.created_at}</span>
                      <span className="ml-auto font-mono text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">{h.action}</span>
                    </div>
                    {h.new_value && <div className="text-sm text-gray-800 mb-1.5">{h.new_value}</div>}
                    {h.old_value && h.old_value !== '(无)' && (
                      <div className="text-xs mb-1.5">
                        <span className="text-gray-500">之前：</span>
                        <span className="line-through text-gray-500">{h.old_value}</span>
                      </div>
                    )}
                    <div className="flex gap-3 flex-wrap text-xs">
                      {h.reason && <div>🔎 <span className="text-gray-500">原因：</span><span className="text-gray-700">{h.reason}</span></div>}
                      {h.remark && <div>📝 <span className="text-gray-500">备注：</span><span className="text-gray-700">{h.remark}</span></div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-1 space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold mb-3">💡 值班人接手指引</h3>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal pl-5">
              <li>右侧上方 <b className="text-brand-700">"放新材料"</b> —— 老周扔过来的手写单/口头说明往这里塞</li>
              <li>本页顶部 <b className="text-amber-700">黄色异常卡片</b> 或 顶栏 <Link to="/anomalies" className="text-red-600 underline">"异常队列"</Link> 看所有问题</li>
              <li>改判结论 → <b>"改判结论"</b>；核准/驳回直接点右上角按钮</li>
              <li>无异常且非挂起 → 点 <b className="text-brand-700">"导出报告"</b> 生成正式 JSON</li>
              <li>本页下方 <b>"历史"</b> 是老周之前所有操作的审计链，不会丢</li>
            </ol>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-3">📊 材料构成</h3>
            <div className="text-sm space-y-2">
              {Object.entries(MATERIAL_LABELS).map(([k, L]) => {
                const n = data.materials.filter(m => m.type === k).length;
                return (
                  <div key={k} className="flex items-center justify-between">
                    <span className={`tag ${L.cls}`}>{L.text}</span>
                    <span className="text-gray-600 font-mono">{n}</span>
                  </div>
                );
              })}
              <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between text-xs">
                <span className="text-gray-500">异常数</span>
                <span className={unresolvedAnomalies.length > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                  {unresolvedAnomalies.length} / {data.anomalies.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddMat && (
        <Modal onClose={() => setShowAddMat(false)} title="📎 新增材料（来自老周的病历/口头说明等）" width="w-[640px]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">材料类型</label>
                <select className="input" value={newMat.type} onChange={e => setNewMat({ ...newMat, type: e.target.value })}>
                  {Object.entries(MATERIAL_LABELS).map(([k, L]) => <option key={k} value={k}>{L.text}</option>)}
                </select>
              </div>
              <div>
                <label className="label">来源/提供者</label>
                <input className="input" value={newMat.source} onChange={e => setNewMat({ ...newMat, source: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">标题 <span className="text-rose-500 text-xs">（与旧记录同名将自动检测为"口径变更"）</span></label>
              <input className="input" value={newMat.title} onChange={e => setNewMat({ ...newMat, title: e.target.value })} placeholder="例如：小黄-初诊病历 / 花卷-房东反馈" />
            </div>
            <div>
              <label className="label">明细内容</label>
              <textarea className="input min-h-[120px]" value={newMat.content} onChange={e => setNewMat({ ...newMat, content: e.target.value })} placeholder="把病历、口头说明原文敲入或粘贴进来…" />
            </div>
            {newMat.type === 'handwritten' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label !mb-0">💊 用药记录 <span className="text-amber-600 text-xs font-normal">（系统会检测同一病历下剂量改动并自动挂起）</span></label>
                  <button className="btn-ghost text-xs" onClick={addMedication}>＋ 添加一行</button>
                </div>
                <div className="space-y-2">
                  {newMat.medications.map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <input className="input flex-1" placeholder="药品名，如：头孢羟氨苄" value={m.drug_name} onChange={e => updateMedication(i, 'drug_name', e.target.value)} />
                      <input className="input flex-1" placeholder="剂量，如：250mg BID 7天" value={m.dosage} onChange={e => updateMedication(i, 'dosage', e.target.value)} />
                      {newMat.medications.length > 1 && <button className="btn-ghost text-rose-600" onClick={() => removeMedication(i)}>✕</button>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn-secondary" onClick={() => setShowAddMat(false)}>取消</button>
            <button className="btn-primary" onClick={submitMaterial}>提交材料</button>
          </div>
        </Modal>
      )}

      {showVerdict && (
        <Modal onClose={() => setShowVerdict(false)} title="✏️ 改判结论（会写入历史，旧结论也保留）" width="w-[560px]">
          <div className="space-y-4">
            <div>
              <label className="label">操作人</label>
              <select className="input" value={verdict.operator} onChange={e => setVerdict({ ...verdict, operator: e.target.value })}>
                <option>寄养店长老周</option><option>算法值班人</option>
              </select>
            </div>
            <div>
              <label className="label">新结论</label>
              <textarea className="input min-h-[100px]" value={verdict.conclusion} onChange={e => setVerdict({ ...verdict, conclusion: e.target.value })} placeholder="例如：建议救助，预计费用 3500 元，需主人签署同意书" />
            </div>
            <div>
              <label className="label">改判原因</label>
              <input className="input" value={verdict.reason} onChange={e => setVerdict({ ...verdict, reason: e.target.value })} placeholder="为什么改，例如：主人补充旧病史，手术难度增加" />
            </div>
            <div>
              <label className="label">备注（可选）</label>
              <input className="input" value={verdict.remark} onChange={e => setVerdict({ ...verdict, remark: e.target.value })} placeholder="给下个接手的人看" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn-secondary" onClick={() => setShowVerdict(false)}>取消</button>
            <button className="btn-primary" onClick={submitVerdict}>确认改判</button>
          </div>
        </Modal>
      )}

      {exported && (
        <Modal onClose={() => setExported(null)} title={`📤 导出成功 · ${exported.case_no}`} width="w-[640px]">
          <div className="text-sm space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Kv k="动物" v={`${exported.animal_type} ${exported.animal_name}`} />
              <Kv k="状态" v={STATUS_LABELS[exported.status]?.text || exported.status} />
              <Kv k="材料数" v={exported.materials.length} />
              <Kv k="用药记录" v={exported.medications.length} />
              <Kv k="导出时间" v={exported.exported_at} />
            </div>
            <div className="p-3 bg-brand-50 rounded text-brand-900"><b>结论：</b>{exported.conclusion || '(无)'}</div>
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-800">查看完整 JSON →</summary>
              <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded overflow-auto max-h-[300px]">{JSON.stringify(exported, null, 2)}</pre>
            </details>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn-secondary" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(exported, null, 2)); notify('ok', 'JSON 已复制'); }}>复制 JSON</button>
            <button className="btn-primary" onClick={() => setExported(null)}>完成</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Kv({ k, v }) {
  return <div className="bg-gray-50 rounded px-3 py-2"><span className="text-gray-500">{k}：</span><span className="font-medium text-gray-800">{v}</span></div>;
}

function Modal({ children, onClose, title, width = 'w-96' }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-start justify-center py-10 overflow-y-auto" onClick={onClose}>
      <div className={`card p-6 ${width} mx-4`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn-ghost text-gray-500 !p-1" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
