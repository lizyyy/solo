import React, { useState, useEffect } from 'react';
import api, { endpoints } from '../api';
import { CollisionCard, QuoteBox, InfoGrid, EmptyState, Modal, Badge, SeverityBadge } from './common';
import { SEVERITY_OPTIONS, formatDateTime, formatDate } from '../types';

export default function CollisionsPage() {
  const [collisions, setCollisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(defaultForm());

  const load = async () => {
    setLoading(true);
    try {
      let url = endpoints.collisions;
      const p = new URLSearchParams();
      if (resolvedFilter !== '') p.set('resolved', resolvedFilter);
      if (severityFilter) p.set('severity', severityFilter);
      if (p.toString()) url += `?${p.toString()}`;
      const res = await api.get(url);
      setCollisions(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [resolvedFilter, severityFilter]);

  const submit = async () => {
    try {
      const res = await api.post(endpoints.collisions, formData);
      if (res.duplicated) {
        alert(`碰撞点重复！\n\n已有碰撞点位置：${res.data.locationText}\n原始说法：${res.data.originalQuote || '无'}`);
        return;
      }
      alert('碰撞点已记录，来源已保留');
      setShowForm(false);
      setFormData(defaultForm());
      load();
    } catch (e) {
      if (e.code === 2 || e.raw?.response?.status === 409) {
        const data = e.raw?.response?.data;
        alert(`重复碰撞点！\n${data?.message}\n位置：${data?.data?.locationText}\n原始会议纪要：${data?.data?.originalQuote || '无'}`);
        return;
      }
      alert(e.message || '提交失败');
    }
  };

  const resolve = async (c) => {
    const resolution = prompt('请输入解决方案：');
    if (resolution === null) return;
    try {
      await api.put(endpoints.collisionDetail(c.id), {
        resolved: true, processingStatus: '已解决', resolution
      });
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="filter-bar">
          <select className="form-control" value={resolvedFilter} onChange={e => setResolvedFilter(e.target.value)}>
            <option value="">全部（是否解决）</option>
            <option value="false">仅未解决</option>
            <option value="true">仅已解决</option>
          </select>
          <select className="form-control" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
            <option value="">全部严重程度</option>
            {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <span className="fs-12" style={{color:'var(--text-muted)'}}>共 {collisions.length} 条</span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 录入碰撞点</button>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 12 }}>
          {loading ? <div className="loading">加载中...</div> :
           collisions.length === 0 ? <EmptyState title="暂无碰撞点" desc="录入后会自动关联会议纪要原始说法和去重" /> :
           collisions.map(c => <CollisionCard key={c.id} collision={c} onResolve={resolve} />)
          }
        </div>
      </div>

      {showForm && (
        <Modal
          title="录入碰撞点"
          onClose={() => setShowForm(false)}
          footer={<>
            <button className="btn" onClick={() => setShowForm(false)}>取消</button>
            <button className="btn btn-primary" onClick={submit}>提交（自动去重）</button>
          </>}
        >
          <div className="form-row">
          <div className="form-group">
            <label>材料编号</label>
            <input className="form-control" value={formData.materialNo}
              onChange={e => setFormData({...formData, materialNo: e.target.value})} />
          </div>
          <div className="form-group">
            <label>严重程度</label>
            <select className="form-control" value={formData.severity}
              onChange={e => setFormData({...formData, severity: e.target.value})}>
              {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          </div>
          <div className="form-row">
          <div className="form-group"><label>楼栋</label><input className="form-control" value={formData.buildingId}
            onChange={e => setFormData({...formData, buildingId: e.target.value})} /></div>
          <div className="form-group"><label>楼层</label><input className="form-control" value={formData.floor}
            onChange={e => setFormData({...formData, floor: e.target.value})} /></div>
          <div className="form-group"><label>轴号X</label><input className="form-control" value={formData.axisX}
            onChange={e => setFormData({...formData, axisX: e.target.value})} /></div>
          <div className="form-group"><label>轴号Y</label><input className="form-control" value={formData.axisY}
            onChange={e => setFormData({...formData, axisY: e.target.value})} /></div>
          </div>
          <div className="form-group"><label>碰撞类型</label>
            <input className="form-control" value={formData.type} placeholder="如：结构-暖通碰撞、埋件偏位"
              onChange={e => setFormData({...formData, type: e.target.value})} />
          </div>
          <div className="form-group"><label>详细描述</label>
            <textarea className="form-control" value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div className="form-group">
            <label>会议纪要原始说法<span style={{color:'var(--warning)'}}>（强烈建议填写，用于追溯）</span></label>
            <textarea className="form-control" value={formData.originalQuote} placeholder="从会议纪要中直接复制粘贴原话"
              onChange={e => setFormData({...formData, originalQuote: e.target.value})} />
          </div>
          <div className="form-group"><label>来源参考（哪个会议哪一条）</label>
            <input className="form-control" value={formData.sourceRef} placeholder="如：2026-6-3结构复核例会 · 第5条"
              onChange={e => setFormData({...formData, sourceRef: e.target.value})} />
          </div>
          <div className="form-row">
          <div className="form-group"><label>处理人</label>
            <input className="form-control" value={formData.assignedTo}
              onChange={e => setFormData({...formData, assignedTo: e.target.value})} />
          </div>
          <div className="form-group"><label>模型参考</label>
            <input className="form-control" value={formData.modelRef} placeholder="如：A-03-S-001 / Revit"
              onChange={e => setFormData({...formData, modelRef: e.target.value})} />
          </div>
          </div>
          <div className="form-group">
            <label>BIM视角（可选，逗号分隔三个坐标）</label>
            <input className="form-control" value={formData._cameraInput || ''}
              placeholder="如：120.5, 45.2, 30.1（eye坐标）"
              onChange={e => {
                const parts = e.target.value.split(',').map(s=>parseFloat(s.trim()));
                setFormData({
                  ...formData,
                  _cameraInput: e.target.value,
                  cameraView: parts.every(p=>!isNaN(p)) && parts.length===3 ? { eye: parts } : null
                });
              }} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function defaultForm() {
  return {
    materialNo: '', buildingId: '', floor: '', axisX: '', axisY: '',
    type: '', severity: 'warning', description: '', originalQuote: '',
    sourceRef: '', assignedTo: '', modelRef: '',
    cameraView: null, _cameraInput: ''
  };
}
