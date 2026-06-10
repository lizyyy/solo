import React, { useState, useEffect } from 'react';
import api, { endpoints } from '../api';
import { InfoGrid, QuoteBox, EmptyState, Modal, Badge, StatusBadge } from './common';
import { formatDate } from '../types';

export default function MinutesPage({ onLinkedMaterial }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [mappings, setMappings] = useState({});
  const [form, setForm] = useState({ title: '', meetingDate: new Date().toISOString().slice(0,10), location: '', attendees: '', jsonText: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);

  const loadList = async () => {
    setLoading(true);
    try {
      const [listRes, mapRes] = await Promise.all([
        api.get(endpoints.minutes),
        api.get(endpoints.minutesMappings)
      ]);
      setList(listRes.data || []);
      setMappings(mapRes.data || {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadDetail = async (id) => {
    try {
      const res = await api.get(endpoints.minutesDetail(id));
      setDetail(res.data);
      setSelectedId(id);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadList(); }, []);

  const doImport = async () => {
    try {
      let items = [];
      if (form.jsonText.trim()) {
        try {
          const parsed = JSON.parse(form.jsonText);
          if (Array.isArray(parsed)) items = parsed;
          else if (parsed.items && Array.isArray(parsed.items)) items = parsed.items;
          else if (typeof parsed === 'object') items = [parsed];
        } catch (e) {
          alert('JSON解析失败，请检查格式');
          return;
        }
      }
      const attendees = form.attendees ? form.attendees.split(/[,，;；]/).map(s=>s.trim()).filter(Boolean) : [];
      const res = await api.post(endpoints.minutes, {
        title: form.title || `会议纪要-${form.meetingDate}`,
        meetingDate: form.meetingDate,
        location: form.location,
        attendees,
        items,
        source: '手动导入'
      });
      if (res.warnings && res.warnings.length > 0) {
        alert(`导入成功！但存在提示：\n\n• ${res.warnings.join('\n• ')}`);
      } else {
        alert('导入成功');
      }
      setShowImport(false);
      setForm({ title: '', meetingDate: new Date().toISOString().slice(0,10), location: '', attendees: '', jsonText: '' });
      loadList();
      if (res.data?.id) loadDetail(res.data.id);
    } catch (e) {
      alert(e.message || '导入失败');
    }
  };

  const addMapping = async () => {
    const canonical = prompt('请输入标准字段名（如：材料编号、碰撞描述、负责人）：');
    if (!canonical) return;
    const alias = prompt('请输入别名（会议纪要中出现的实际名称）：');
    if (!alias) return;
    try {
      await api.post(endpoints.minutesMappings, { canonical, alias });
      alert('已添加别名映射，下次导入自动识别');
      loadList();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="flex gap-2 items-center flex-wrap">
          <button className="btn btn-primary" onClick={() => setShowImport(true)}>+ 导入会议纪要</button>
          <button className="btn" onClick={addMapping}>📋 添加字段别名</button>
        </div>
        <span className="fs-12" style={{color:'var(--text-muted)'}}>
          共 {list.length} 份纪要
        </span>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading">加载中...</div> :
           list.length === 0 ? <EmptyState title="暂无会议纪要" desc="导入后将自动标准化字段名、关联材料" /> :
           <table>
            <thead>
              <tr>
                <th style={{width:32}}></th>
                <th>标题</th>
                <th>日期</th>
                <th>地点</th>
                <th>参与人</th>
                <th>条目数</th>
                <th>来源</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map(m => (
                <React.Fragment key={m.id}>
                  <tr>
                    <td>
                      <span className={`expand-icon ${selectedId===m.id?'open':''}`} onClick={() => selectedId===m.id ? setSelectedId(null) : loadDetail(m.id)}>›</span>
                    </td>
                    <td style={{fontWeight:500}}>{m.title}</td>
                    <td className="no-wrap">{formatDate(m.meetingDate)}</td>
                    <td>{m.location || '-'}</td>
                    <td>{(m.attendees||[]).join('、') || '-'}</td>
                    <td><Badge variant="info">{m.items?.length || 0} 条</Badge></td>
                    <td className="fs-12" style={{color:'var(--text-sub)'}}>{m.source}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => loadDetail(m.id)}>展开</button>
                    </td>
                  </tr>
                  {selectedId === m.id && (
                    <tr className="detail-row"><td colSpan={8}>
                      <div className="detail-content">
                        {!detail ? <div className="loading">加载详情中...</div>
                         : detail && detail.id === m.id ? renderDetail(detail, mappings, addMapping, onLinkedMaterial)
                         : null}
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
           </table>
          }
        </div>
      </div>

      {showImport && (
        <Modal
          title="导入会议纪要"
          onClose={() => setShowImport(false)}
          footer={<>
            <button className="btn" onClick={() => setShowImport(false)}>取消</button>
            <button className="btn btn-primary" onClick={doImport}>开始导入（自动标准化字段）</button>
          </>}
        >
          <div className="form-row">
          <div className="form-group"><label>会议标题<span className="required">*</span></label>
            <input className="form-control" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="如：2026年6月第二周结构复核例会" />
          </div>
          <div className="form-group"><label>会议日期</label>
            <input type="date" className="form-control" value={form.meetingDate} onChange={e=>setForm({...form,meetingDate:e.target.value})} />
          </div>
          </div>
          <div className="form-row">
          <div className="form-group"><label>地点</label>
            <input className="form-control" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} />
          </div>
          <div className="form-group"><label>参与人（逗号分隔）</label>
            <input className="form-control" value={form.attendees} onChange={e=>setForm({...form,attendees:e.target.value})} placeholder="老叶，张工，李工" />
          </div>
          </div>
          <div className="form-group">
            <label>会议条目（JSON数组，字段名会自动标准化）<span className="required">*</span></label>
            <textarea className="form-control" style={{minHeight: 180, fontFamily:'monospace', fontSize: 12}}
              placeholder={`[\n  {\n    "编号": "RZ-001",\n    "问题描述": "3层/轴C-5与风管冲突",\n    "责任人": "老叶"\n  }\n]`}
              value={form.jsonText} onChange={e=>setForm({...form,jsonText:e.target.value})} />
          </div>
          <div className="field-map-panel">
            <strong style={{fontSize:12}}>💡 当前识别规则：</strong>
            <div className="mt-2">
              {Object.entries(mappings).map(([key, aliases]) => (
                <div key={key} className="fs-12" style={{padding:'2px 0'}}>
                  <span className="field-mapped">{key}</span>
                  {aliases.length > 0 && <><span className="field-arrow"> ← </span>
                    <span className="field-original">[{aliases.join('、')}]</span></>}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function renderDetail(m, mappings, onAddMapping, onLinkedMaterial) {
  const process = async (item, linked) => {
    if (!confirm(`标记第 ${item.index} 条为已处理？`)) return;
    try {
      await api.put(`${endpoints.minutes}/${m.id}/items/${item.itemId}`, { processed: !item.processed });
    } catch (e) { alert(e.message); }
  };
  return (
    <div>
      <div className="section-title">基础信息</div>
      <InfoGrid items={[
        { label: '标题', value: m.title },
        { label: '日期', value: formatDate(m.meetingDate) },
        { label: '地点', value: m.location },
        { label: '参与人', value: (m.attendees||[]).join('、') },
        { label: '导入来源', value: m.source },
        { label: '导入人', value: m.importedBy }
      ]} />
      <div className="section-title">字段映射记录（原始字段名 → 标准字段）</div>
      {Object.entries(m.keyMap || {}).length > 0 ? (
        <div className="field-map-panel">
          {Object.entries(m.keyMap || {}).map(([orig, mapped]) => (
            <div key={orig} className="field-map-row">
              <span className="field-original">{orig}</span>
              {orig !== mapped ? (
                <><span className="field-arrow">→</span><span className="field-mapped">{mapped}</span></>
              ) : <span className="field-arrow" style={{color:'var(--text-muted)'}}>（已标准化）</span>}
            </div>
          ))}
        </div>
      ) : <div className="fs-12" style={{color:'var(--text-muted)'}}>无映射变更</div>}
      <div className="section-title">会议条目（{(m.items||[]).length} 条）</div>
      {(m.items || []).map(item => (
        <div key={item.itemId} style={{border: '1px solid var(--border)', borderRadius:'var(--radius-sm)', padding: '12px 14px', marginBottom: 8, background: '#fff', position: 'relative'}}>
          <div className="flex justify-between items-start gap-2 flex-wrap">
            <div style={{fontWeight: 600, fontSize: 13}}>
            第 {item.index} 条
            {item.materialNo && <span className="badge badge-primary ml-2">{item.materialNo}</span>}
            {item.owner && <span className="ml-2 fs-12" style={{color:'var(--text-sub)'}}>责任人：{item.owner}</span>}
            {item.processed && <span className="badge badge-success ml-2">已处理</span>}
          </div>
          <button className="btn btn-sm" onClick={() => process(item)}>{item.processed?'取消处理':'标记已处理'}</button>
        </div>
        <QuoteBox text={item.content || item.collisionDesc || (item.rawItem ? JSON.stringify(item.rawItem).slice(0,200) : null)} source={item.collisionDesc ? `原始字段：碰撞描述` : null} />
        <div className="decision-meta">
          {item.materialNo && <span>材料编号：<strong>{item.materialNo}</strong></span>}
          {item.owner && <span>责任人：{item.owner}</span>}
          {item.deadline && <span>截止日期：{item.deadline}</span>}
          {item.status && <span>状态：{item.status}</span>}
          {item.linkedMaterialId && <span className="text-success">✓ 已关联材料</span>}
        </div>
        <div className="collision-actions">
          {!item.linkedMaterialId && item.materialNo && onLinkedMaterial && (
            <button className="btn btn-sm btn-primary" onClick={() => onLinkedMaterial({ materialNo: item.materialNo })}>→ 跳转材料复核</button>
          )}
        </div>
        </div>
      ))}
      {m.linkedCollisions && m.linkedCollisions.length > 0 && (
        <div className="section-title">关联碰撞点（{m.linkedCollisions.length}）</div>
      )}
    </div>
  );
}
