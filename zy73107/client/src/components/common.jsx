import React from 'react';
import { getStatusMeta, getSeverityMeta, formatDateTime, formatDate } from '../types';

export function Badge({ children, variant = 'default' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  return <span className={meta.badge}>{meta.label}</span>;
}

export function SeverityBadge({ severity }) {
  const meta = getSeverityMeta(severity);
  return <span className={meta.badge}>{meta.label}</span>;
}

export function QuoteBox({ text, source }) {
  if (!text && !source) return null;
  return (
    <div className="quote-box">
      {text || '（未记录原始说法）'}
      {source && <span className="quote-source">—— 来源：{source}</span>}
    </div>
  );
}

export function ContributionRow({ label, value, breakdown, source, contribution }) {
  return (
    <div className="contribution-row">
      <div className="flex justify-between items-center gap-2">
        <span><strong>{label}：</strong>{value} 项</span>
        {source && <span className="fs-12 text-muted font-mono">规则: {source}</span>}
      </div>
      {breakdown && breakdown.length > 0 && (
        <div className="mt-2 fs-12" style={{ color: 'var(--text-sub)' }}>
          <span className="contribution-arrow">↳</span>
          拉动明细：{breakdown}
        </div>
      )}
    </div>
  );
}

export function StatCard({ variant = 'default', value, label, note, onClick }) {
  return (
    <div className={`stat-card ${variant}`} onClick={onClick}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}

export function InfoGrid({ items }) {
  return (
    <div className="info-grid">
      {items.map((it, i) => (
        <div className="info-item" key={i}>
          <span className="info-label">{it.label}</span>
          <span className="info-value">{it.value || '-'}</span>
        </div>
      ))}
    </div>
  );
}

export function Timeline({ history }) {
  if (!history || history.length === 0) {
    return <div className="fs-12" style={{ color: 'var(--text-muted)' }}>暂无操作历史</div>;
  }
  return (
    <div className="history-list">
      {history.slice().reverse().map((h, i) => (
        <div className="history-item" key={i}>
          <span className="history-time">{formatDateTime(h.time)}</span>
          <span className="history-action">{h.action}</span>
          <span className="history-operator">{h.operator}</span>
          <span>{h.detail}</span>
        </div>
      ))}
    </div>
  );
}

export function CollisionCard({ collision, onResolve, onLink }) {
  const sev = getSeverityMeta(collision.severity);
  const classes = `collision-card ${collision.severity === 'critical' ? 'critical' : collision.severity === 'info' ? 'info' : ''} ${collision.resolved ? 'resolved' : ''}`;
  return (
    <div className={classes}>
      <div className="collision-header">
        <div className="flex gap-2 items-center flex-wrap">
          <span className="collision-location">{collision.locationText || '位置未记录'}</span>
          <SeverityBadge severity={collision.severity} />
          <span className="badge badge-default">{collision.type || '碰撞'}</span>
          {collision.cameraView && (
            <span className="camera-view-badge">📷 视角已保存</span>
          )}
          {collision.screenshot && (
            <span className="camera-view-badge" style={{background:'#fce7f3',color:'#be185d'}}>🖼 有截图</span>
          )}
          {collision.resolved && <span className="badge badge-success">已解决</span>}
        </div>
        {collision.modelRef && <span className="fs-12" style={{color:'var(--text-sub)'}}>模型: {collision.modelRef}</span>}
      </div>
      <div className="collision-body">
        {collision.description && <p>{collision.description}</p>}
        {(collision.originalQuote || collision.sourceRef) && (
          <QuoteBox text={collision.originalQuote} source={collision.sourceRef} />
        )}
        <div className="flex gap-2 flex-wrap mt-2 fs-12">
          {collision.assignedTo && <span>处理人：<strong>{collision.assignedTo}</strong></span>}
          {collision.processingStatus && <span>当前状态：{collision.processingStatus}</span>}
          {collision.resolution && <span>方案：{collision.resolution}</span>}
        </div>
      </div>
      {(onResolve || onLink) && (
        <div className="collision-actions">
          {!collision.resolved && onResolve && (
            <button className="btn btn-sm btn-success" onClick={() => onResolve(collision)}>标记解决</button>
          )}
          {onLink && !collision.sourceMinutesId && (
            <button className="btn btn-sm btn-primary" onClick={() => onLink(collision)}>关联会议纪要</button>
          )}
          {collision.cameraView && (
            <span className="fs-12" style={{color:'var(--info)'}}>
              📐 视角坐标: [{collision.cameraView.eye?.join(', ')}]
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ title, desc, action }) {
  return (
    <div className="empty-state">
      {title && <h4>{title}</h4>}
      {desc && <p>{desc}</p>}
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
