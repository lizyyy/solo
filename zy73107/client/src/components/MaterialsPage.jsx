import React, { useState, useEffect } from 'react';
import api, { endpoints } from '../api';
import { StatusBadge, InfoGrid, CollisionCard, QuoteBox, Timeline, EmptyState, Modal } from './common';
import { STATUS_OPTIONS, formatDate, formatDateTime } from '../types';

export default function MaterialsPage({ selectedMaterialId, onCloseDetail }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ status: '', reviewConclusion: '', remarks: '' });

  const load = async () => {
    setLoading(true);
    try {
      let url = endpoints.materials;
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (keyword) params.set('keyword', keyword);
      if (params.toString()) url += `?${params.toString()}`;
      const res = await api.get(url);
      setMaterials(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterStatus, keyword]);

  useEffect(() => {
    if (selectedMaterialId) {
      loadDetail(selectedMaterialId);
    }
  }, [selectedMaterialId]);

  const loadDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await api.get(endpoints.materialDetail(id));
      setDetail(res.data);
      setExpandedId(id);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const openReview = (mat) => {
    setDetail(mat);
    setReviewForm({ status: mat.status || '', reviewConclusion: mat.reviewConclusion || '', remarks: mat.remarks || '' });
    setShowReviewModal(true);
  };

  const submitReview = async () => {
    if (!detail) return;
    try {
      const res = await api.post(endpoints.materialReview(detail.id), reviewForm);
      alert(`复核完成：${res.decision?.text || '已更新'}`);
      setShowReviewModal(false);
      load();
      loadDetail(detail.id);
    } catch (e) {
      alert(e.message || '提交失败');
    }
  };

  const resolveCollision = async (col) => {
    const resolution = prompt('请输入解决方案：', `已与设计方确认，按方案调整`);
    if (resolution === null) return;
    try {
      await api.put(endpoints.collisionDetail(col.id), {
        resolved: true,
        processingStatus: '已解决',
        resolution
      });
      alert('碰撞点已标记为解决');
      detail && loadDetail(detail.id);
      load();
    } catch (e) {
      alert(e.message || '操作失败');
    }
  };

  return (
    <div>
      <div className="filter-bar">
        <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input
          className="form-control"
          placeholder="搜索材料编号/名称..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <span className="fs-12" style={{color:'var(--text-muted)'}}>共 {materials.length} 条</span>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? <div className="loading">加载中...</div> :
          materials.length === 0 ? <EmptyState title="暂无材料" desc="请在会议纪要导入中关联材料或手动添加" /> :
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>材料编号</th>
                <th>名称</th>
                <th>分类</th>
                <th>数量/规格</th>
                <th>状态</th>
                <th>来源</th>
                <th>更新时间</th>
                <th style={{ width: 160 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(m => (
                <React.Fragment key={m.id}>
                  <tr>
                    <td>
                      <span className={`expand-icon ${expandedId===m.id?'open':''}`}
                            onClick={() => expandedId===m.id ? setExpandedId(null) : loadDetail(m.id)}>
                        ›
                      </span>
                    </td>
                    <td><span className="font-mono">{m.materialNo || '-'}</span></td>
                    <td style={{ fontWeight: 500 }}>{m.name || '-'}</td>
                    <td>{m.category || '-'}</td>
                    <td className="no-wrap">{m.quantity}{m.unit || ''} {m.specification && <span className="fs-12" style={{color:'var(--text-sub)'}}>/ {m.specification}</span>}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td className="fs-12" style={{color:'var(--text-sub)'}}>{m.source || '-'}</td>
                    <td className="fs-12" style={{color:'var(--text-muted)'}}>{formatDate(m.updatedAt)}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        <button className="btn btn-sm btn-primary" onClick={() => loadDetail(m.id)}>展开</button>
                        <button className="btn btn-sm btn-success" onClick={() => openReview(m)}>复核</button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === m.id && (
                    <tr className="detail-row">
                      <td colSpan={9}>
                        <div className="detail-content">
                          {detailLoading ? <div className="loading">加载详情中...</div> :
                           detail && detail.id === m.id ? renderDetail(detail, openReview, resolveCollision) :
                           <EmptyState title="加载详情失败" />}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>}
        </div>
      </div>

      {showReviewModal && detail && (
        <Modal
          title={`复核材料：${detail.name || detail.materialNo}`}
          onClose={() => setShowReviewModal(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowReviewModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={submitReview}>提交复核结论</button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label>复核结论<span className="required">*</span></label>
              <select className="form-control" value={reviewForm.status}
                onChange={e => setReviewForm({ ...reviewForm, status: e.target.value })}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>复核人</label>
              <input className="form-control" value={detail.reviewer || ''} disabled />
            </div>
          </div>
          <div className="form-group">
            <label>复核结论说明</label>
            <textarea className="form-control" placeholder="请说明放行/暂扣/补材料的具体原因和要求"
              value={reviewForm.reviewConclusion}
              onChange={e => setReviewForm({ ...reviewForm, reviewConclusion: e.target.value })} />
          </div>
          <div className="form-group">
            <label>备注</label>
            <textarea className="form-control" placeholder="其他补充说明"
              value={reviewForm.remarks}
              onChange={e => setReviewForm({ ...reviewForm, remarks: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function renderDetail(d, onReview, onResolve) {
  const collisionCount = d.collisions?.length || 0;
  const unresolved = (d.collisions || []).filter(c => !c.resolved).length;
  return (
    <div>
      <InfoGrid items={[
        { label: '材料编号', value: d.materialNo },
        { label: '名称', value: d.name },
        { label: '分类', value: d.category },
        { label: '数量', value: `${d.quantity || 0} ${d.unit || ''}` },
        { label: '规格', value: d.specification },
        { label: '当前状态', value: d.status },
        { label: '来源', value: d.source },
        { label: '复核人', value: d.reviewer },
        { label: '碰撞点', value: collisionCount ? `${collisionCount} 条（${unresolved} 未解决）` : '无' },
        { label: '最后更新', value: formatDateTime(d.updatedAt) }
      ]} />

      {d.reviewConclusion && (
        <div className="section-title">复核结论</div>
      )}
      {d.reviewConclusion && (
        <div className="quote-box" style={{background:'#eff6ff',borderColor:'#93c5fd',paddingLeft:14}}>
          {d.reviewConclusion}
          {d.reviewer && <span className="quote-source">—— {d.reviewer}</span>}
        </div>
      )}

      <div className="section-title">关联碰撞点（{collisionCount}）</div>
      {collisionCount === 0 ? (
        <div className="fs-12" style={{color:'var(--text-muted)'}}>当前材料未关联碰撞点</div>
      ) : (
        <div>
          {(d.collisions || []).map(c => (
            <CollisionCard key={c.id} collision={c}
              onResolve={onResolve} />
          ))}
        </div>
      )}

      <div className="section-title">操作历史</div>
      <Timeline history={d.history} />
    </div>
  );
}
