import React from 'react';
import { Badge, QuoteBox, InfoGrid, CollisionCard } from './common';
import api, { endpoints } from '../api';

export default function DecisionsPanel({ decisions, onRefresh, onReviewMaterial }) {
  if (!decisions) return null;

  const { release, supplement, hold } = decisions;

  const handleApprove = async (item) => {
    if (!confirm(`确认放行【${item.name || item.materialNo}】？`)) return;
    try {
      await api.post(endpoints.materialReview(item.materialId), {
        status: 'approved',
        reviewConclusion: '复核通过，准予放行'
      });
      onRefresh && onRefresh();
    } catch (e) {
      alert(e.message || '操作失败');
    }
  };

  const handleRequestSupplement = async (item) => {
    const conclusion = prompt(`请说明【${item.name || item.materialNo}】需要补充的具体内容：`, item.missingInfo?.join('；') || '');
    if (conclusion === null) return;
    try {
      await api.post(endpoints.materialReview(item.materialId), {
        status: 'need_supplement',
        reviewConclusion: conclusion
      });
      onRefresh && onRefresh();
    } catch (e) {
      alert(e.message || '操作失败');
    }
  };

  return (
    <div>
      <div className="card decision-section">
        <div className="decision-header release">✅ 可放行材料（{release.length}）</div>
        <div className="decision-body">
          {release.length === 0 ? (
            <div className="fs-12" style={{color:'var(--text-muted)'}}>当前无满足放行条件的材料</div>
          ) : release.map(item => (
            <div key={item.materialId} className="decision-item">
              <div className="decision-title">
                <span className="decision-material-name">
                  <span className="badge badge-primary mr-2">{item.materialNo}</span>
                  {item.name}
                </span>
                <div className="flex gap-2">
                  {item.category && <span className="badge badge-default">{item.category}</span>}
                  <Badge variant="success">可放行</Badge>
                </div>
              </div>
              <InfoGrid items={[
                { label: '放行理由', value: item.reason },
                { label: '复核人', value: item.reviewer },
                { label: '复核结论', value: item.conclusion }
              ]} />
              <div className="decision-action-bar">
                <button className="btn btn-success btn-sm" onClick={() => handleApprove(item)}>
                  确认放行
                </button>
                <button className="btn btn-sm" onClick={() => onReviewMaterial && onReviewMaterial(item)}>
                  查看详情
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card decision-section">
        <div className="decision-header supplement">📝 需补充材料（{supplement.length}）</div>
        <div className="decision-body">
          {supplement.length === 0 ? (
            <div className="fs-12" style={{color:'var(--text-muted)'}}>当前没有需要补充的材料</div>
          ) : supplement.map(item => (
            <div key={item.materialId} className="decision-item">
              <div className="decision-title">
                <span className="decision-material-name">
                  <span className="badge badge-primary mr-2">{item.materialNo}</span>
                  {item.name}
                </span>
                <div className="flex gap-2">
                  {item.category && <span className="badge badge-default">{item.category}</span>}
                  <Badge variant="warning">需补材料</Badge>
                </div>
              </div>
              <div className="section-title">缺少信息</div>
              <ul style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-sub)' }}>
                {(item.missingInfo || []).map((m, i) => <li key={i}>{m}</li>)}
              </ul>
              <div className="decision-meta">
                {item.owner && <span>责任人：<strong>{item.owner}</strong></span>}
                {item.collisionCount > 0 && <span>碰撞点：<strong className="text-warning">{item.collisionCount}</strong> 条</span>}
              </div>
              <div className="decision-action-bar">
                <button className="btn btn-warning btn-sm" onClick={() => handleRequestSupplement(item)}>
                  更新补充要求
                </button>
                <button className="btn btn-sm" onClick={() => onReviewMaterial && onReviewMaterial(item)}>
                  进入复核
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card decision-section">
        <div className="decision-header hold">⚠️ 暂扣处理（{hold.length}）</div>
        <div className="decision-body">
          {hold.length === 0 ? (
            <div className="fs-12" style={{color:'var(--text-muted)'}}>当前无暂扣材料</div>
          ) : hold.map(item => (
            <div key={item.materialId} className="decision-item">
              <div className="decision-title">
                <span className="decision-material-name">
                  <span className="badge badge-primary mr-2">{item.materialNo}</span>
                  {item.name}
                </span>
                <div className="flex gap-2">
                  {item.category && <span className="badge badge-default">{item.category}</span>}
                  <Badge variant="danger">{item.reason}</Badge>
                </div>
              </div>
              <div className="section-title">未解决碰撞点</div>
              {(item.collisions || []).map(c => (
                <div key={c.id}>
                  <div className="flex gap-2 items-center mt-2 mb-1 flex-wrap">
                    <strong className="fs-12" style={{ color: 'var(--text)' }}>📍 {c.location}</strong>
                    <span className={`badge ${c.severity==='critical'?'badge-danger':c.severity==='info'?'badge-info':'badge-warning'}`}>
                      {c.type}
                    </span>
                  </div>
                  <QuoteBox text={c.originalQuote} source={c.sourceRef} />
                </div>
              ))}
              <div className="decision-action-bar">
                <button className="btn btn-primary btn-sm" onClick={() => onReviewMaterial && onReviewMaterial(item)}>
                  进入复核处理碰撞
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
