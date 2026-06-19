import React, { useState, useEffect } from 'react';
import {
  getTraceback, TracebackResult, addRemark, updateRemark,
  getRemarkHistory, RemarkHistoryItem, submitCrewBriefing, getReport,
} from '../utils/api';

interface Props {
  recordId: string | null;
  onBack: () => void;
}

const STAGE_LABEL: Record<string, string> = {
  imported: '📥 首次导入',
  engineer_reviewed: '🔧 工程师补看备注',
  crew_briefed: '👷 现场班组说明已更新',
};

const COORD_LABEL: Record<string, string> = {
  latlng: '经纬度',
  metric: '米制',
  mixed: '⚠️ 经纬度与米制混用',
  latlng_with_distance: '经纬度+测距距离',
};

export default function RecordDetail({ recordId, onBack }: Props) {
  const [data, setData] = useState<TracebackResult | null>(null);
  const [remarkAuthor, setRemarkAuthor] = useState('');
  const [remarkContent, setRemarkContent] = useState('');
  const [editRemarkId, setEditRemarkId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [historyMap, setHistoryMap] = useState<Record<string, RemarkHistoryItem[]>>({});
  const [briefing, setBriefing] = useState({ why_kept: '', missing_materials: '', next_step_owner: 'inspection', next_step_description: '', param_version: '', param_tradeoff_reason: '' });
  const [reportText, setReportText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    getTraceback(recordId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [recordId]);

  const handleAddRemark = async () => {
    if (!recordId || !remarkAuthor.trim() || !remarkContent.trim()) return;
    await addRemark(recordId, remarkAuthor.trim(), remarkContent.trim());
    setRemarkAuthor('');
    setRemarkContent('');
    const d = await getTraceback(recordId);
    setData(d);
  };

  const handleUpdateRemark = async () => {
    if (!editRemarkId || !editContent.trim()) return;
    await updateRemark(editRemarkId, editContent.trim(), '许工', '补充障碍物备注');
    setEditRemarkId(null);
    setEditContent('');
    const d = await getTraceback(recordId!);
    setData(d);
  };

  const loadHistory = async (remarkId: string) => {
    if (historyMap[remarkId]) return;
    const h = await getRemarkHistory(remarkId);
    setHistoryMap((prev) => ({ ...prev, [remarkId]: h }));
  };

  const handleBriefing = async () => {
    if (!recordId) return;
    await submitCrewBriefing({
      record_id: recordId,
      why_kept: briefing.why_kept,
      missing_materials: briefing.missing_materials,
      next_step_owner: briefing.next_step_owner,
      next_step_description: briefing.next_step_description,
      param_version: briefing.param_version || undefined,
      param_tradeoff_reason: briefing.param_tradeoff_reason || undefined,
    });
    setBriefing({ why_kept: '', missing_materials: '', next_step_owner: 'inspection', next_step_description: '', param_version: '', param_tradeoff_reason: '' });
    const d = await getTraceback(recordId);
    setData(d);
  };

  const handleViewReport = async (reportId: string) => {
    const r = await getReport(reportId);
    setReportText(r.report_text);
  };

  if (!recordId) return null;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>加载中...</div>;
  if (!data) return null;

  const record = data.record;
  const isMixed = record.coord_type === 'mixed';
  const isLatLngWithDistance = record.coord_type === 'latlng_with_distance';

  const coordBoxBg = isMixed ? '#fffbeb' : isLatLngWithDistance ? '#f0fdf4' : '#f8fafc';
  const coordBoxBorder = isMixed ? '#fbbf24' : isLatLngWithDistance ? '#86efac' : '#e2e8f0';

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>
          ← 返回列表
        </button>
        <h3 style={{ fontSize: 16, color: '#1a1a2e' }}>🔍 记录详情与溯源</h3>
      </div>

      <div style={{ background: coordBoxBg, borderRadius: 6, padding: 14, marginBottom: 16, border: `1px solid ${coordBoxBorder}` }}>
        <div style={{ fontSize: 13, marginBottom: 6 }}>
          <strong>批次：</strong>{record.batch_id} &nbsp;|&nbsp;
          <strong>坐标类型：</strong>{COORD_LABEL[record.coord_type]}
        </div>
        <div style={{ fontSize: 13, marginBottom: 6 }}>
          <strong>原始数据：</strong><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 3 }}>{record.raw_data}</code>
        </div>
        {isMixed && (
          <div style={{ color: '#d97706', fontSize: 13, marginTop: 6 }}>
            ⚠️ 本条经纬度与米制坐标混用，不急于归正常，留给巡检组复核。
          </div>
        )}
        {isLatLngWithDistance && (
          <div style={{ color: '#16a34a', fontSize: 13, marginTop: 6 }}>
            ✅ 经纬度正常，已补充测距距离，不归入坐标混用。
          </div>
        )}
      </div>

      <h4 style={{ fontSize: 14, marginBottom: 8 }}>📜 快照历史（改前改后追踪）</h4>
      <div style={{ marginBottom: 16 }}>
        {data.snapshots.map((s, i) => (
          <div key={s.id} style={{ padding: '8px 12px', background: i % 2 === 0 ? '#f8fafc' : '#fff', borderLeft: '3px solid #3b82f6', marginBottom: 4, fontSize: 13 }}>
            <strong>{STAGE_LABEL[s.stage] || s.stage}</strong>
            <span style={{ color: '#888', marginLeft: 8 }}>{s.created_at?.slice(0, 19)}</span>
            {s.snapshot_data && (
              <div style={{ marginTop: 4, fontSize: 12, color: '#555' }}>
                {s.snapshot_data.needs_review && <span style={{ color: '#d97706' }}>⚠️ 待复核 </span>}
                坐标类型: {s.snapshot_data.coord_type}
                {s.snapshot_data.actor && <span> | 操作人: {s.snapshot_data.actor}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <h4 style={{ fontSize: 14, marginBottom: 8 }}>📝 障碍物备注</h4>
      <div style={{ marginBottom: 12 }}>
        {data.remarks.length === 0 && <div style={{ fontSize: 13, color: '#888' }}>暂无备注</div>}
        {data.remarks.map((r) => (
          <div key={r.id} style={{ padding: 10, background: '#f8fafc', borderRadius: 6, marginBottom: 6, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{r.author}</span>
              <span style={{ fontSize: 11, color: '#888' }}>{r.updated_at?.slice(0, 19)}</span>
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{r.content}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                onClick={() => { setEditRemarkId(r.id); setEditContent(r.content); }}
                style={{ fontSize: 12, padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
              >
                修改
              </button>
              <button
                onClick={() => loadHistory(r.id)}
                style={{ fontSize: 12, padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
              >
                变更历史
              </button>
            </div>
            {historyMap[r.id] && historyMap[r.id].length > 0 && (
              <div style={{ marginTop: 8, padding: 8, background: '#fff', borderRadius: 4, border: '1px solid #e5e7eb' }}>
                {historyMap[r.id].map((h) => (
                  <div key={h.id} style={{ fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#dc2626' }}>改前: {h.old_value}</span>
                    <span style={{ margin: '0 6px' }}>→</span>
                    <span style={{ color: '#16a34a' }}>改后: {h.new_value}</span>
                    <span style={{ color: '#888', marginLeft: 8 }}>({h.changed_by} {h.changed_at?.slice(0, 19)})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {editRemarkId && (
        <div style={{ marginBottom: 12, padding: 10, background: '#fefce8', borderRadius: 6 }}>
          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }} />
          <div style={{ marginTop: 6 }}>
            <button onClick={handleUpdateRemark} style={{ padding: '4px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>保存修改</button>
            <button onClick={() => setEditRemarkId(null)} style={{ marginLeft: 8, padding: '4px 14px', background: '#e5e7eb', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>取消</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16, padding: 12, background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd' }}>
        <h4 style={{ fontSize: 13, marginBottom: 6 }}>新增障碍物备注（设备工程师许工）</h4>
        <input value={remarkAuthor} onChange={(e) => setRemarkAuthor(e.target.value)} placeholder="填写人" style={{ width: '100%', padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, marginBottom: 6 }} />
        <textarea value={remarkContent} onChange={(e) => setRemarkContent(e.target.value)} placeholder="备注内容" rows={2} style={{ width: '100%', padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, marginBottom: 6 }} />
        <button onClick={handleAddRemark} style={{ padding: '4px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>提交备注</button>
      </div>

      <h4 style={{ fontSize: 14, marginBottom: 8 }}>👷 现场班组说明更新</h4>
      <div style={{ marginBottom: 16, padding: 12, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
        <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 2 }}>为什么保留这条</label>
        <input value={briefing.why_kept} onChange={(e) => setBriefing((b) => ({ ...b, why_kept: e.target.value }))} style={{ width: '100%', padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, marginBottom: 6 }} />
        <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 2 }}>还缺什么材料</label>
        <input value={briefing.missing_materials} onChange={(e) => setBriefing((b) => ({ ...b, missing_materials: e.target.value }))} style={{ width: '100%', padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, marginBottom: 6 }} />
        <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 2 }}>下一步该找谁</label>
        <select value={briefing.next_step_owner} onChange={(e) => setBriefing((b) => ({ ...b, next_step_owner: e.target.value }))} style={{ width: '100%', padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, marginBottom: 6 }}>
          <option value="inspection">巡检组</option>
          <option value="engineer_xu">设备工程师许工</option>
          <option value="crew">现场班组</option>
        </select>
        <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 2 }}>下一步说明</label>
        <input value={briefing.next_step_description} onChange={(e) => setBriefing((b) => ({ ...b, next_step_description: e.target.value }))} style={{ width: '100%', padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, marginBottom: 6 }} />
        <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 2 }}>参数版本（选填）</label>
        <input value={briefing.param_version} onChange={(e) => setBriefing((b) => ({ ...b, param_version: e.target.value }))} style={{ width: '100%', padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, marginBottom: 6 }} />
        <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 2 }}>取舍理由（选填）</label>
        <input value={briefing.param_tradeoff_reason} onChange={(e) => setBriefing((b) => ({ ...b, param_tradeoff_reason: e.target.value }))} style={{ width: '100%', padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, marginBottom: 6 }} />
        <button onClick={handleBriefing} style={{ padding: '4px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>提交班组说明</button>
      </div>

      {data.reports.length > 0 && (
        <>
          <h4 style={{ fontSize: 14, marginBottom: 8 }}>📄 生成的报告</h4>
          {data.reports.map((r) => (
            <div key={r.id} style={{ marginBottom: 8 }}>
              <button onClick={() => handleViewReport(r.id)} style={{ fontSize: 13, padding: '4px 12px', border: '1px solid #3b82f6', borderRadius: 4, background: '#eff6ff', color: '#3b82f6', cursor: 'pointer' }}>
                查看报告 {r.id.slice(0, 8)}
              </button>
              {r.param_version && <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>参数版本: {r.param_version}</span>}
            </div>
          ))}
        </>
      )}

      {reportText && (
        <div style={{ marginTop: 12, padding: 16, background: '#1e293b', color: '#e2e8f0', borderRadius: 8, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {reportText}
        </div>
      )}
    </div>
  );
}
