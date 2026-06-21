import React from 'react';
import { ANOMALY_TRACES } from '../data/mockData';

const AnomalyDetail = ({ point }) => {
  if (!point) {
    return <div className="empty">请在平面图上选择一个测点查看异常详情</div>;
  }

  const traces = ANOMALY_TRACES[point.id] || [];

  return (
    <div>
      {/* 头部 */}
      <div className="anomaly-header">
        <div className="anomaly-title">
          {point.hasAnomaly ? (
            <span className={`badge badge-${point.anomalyLevel === '高' ? 'high' : point.anomalyLevel === '中' ? 'mid' : 'low'}`}>
              异常 · {point.anomalyLevel}
            </span>
          ) : (
            <span className="badge badge-ok">正常</span>
          )}
          {point.name}
        </div>
        <div className="anomaly-meta">
          {point.itemNo} · 状态：{point.status}
        </div>
      </div>

      {/* 基本信息 */}
      <div className="detail-section">
        <h4>测点信息</h4>
        <div className="detail-grid">
          <div>
            <div className="k">空间位置</div>
            <div className="v">{point.roomId ? point.roomId + ' · ' : ''}{point.name}</div>
          </div>
          <div>
            <div className="k">异常类型</div>
            <div className="v">{point.anomalyType || '-'}</div>
          </div>
          <div>
            <div className="k">模型坐标</div>
            <div className="v" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
              {point.modelRef}
            </div>
          </div>
          <div>
            <div className="k">负责人</div>
            <div className="v">{point.coordinator}</div>
          </div>
        </div>
      </div>

      {/* 坐标偏移 */}
      {point.offset && (
        <div className="detail-section">
          <h4>坐标偏移量</h4>
          <div className="detail-grid">
            <div>
              <div className="k">X 偏差</div>
              <div className="v">{point.offset.x} mm</div>
            </div>
            <div>
              <div className="k">Y 偏差</div>
              <div className="v">{point.offset.y} mm</div>
            </div>
            <div>
              <div className="k">Z 偏差</div>
              <div className="v">{point.offset.z} mm</div>
            </div>
            <div>
              <div className="k">欧氏距离</div>
              <div className="v" style={{ color: point.offset.exceeds ? '#dc2626' : '#059669' }}>
                {point.offset.distance?.toFixed(1)} mm
                {point.offset.exceeds ? ' ⚠超限' : ' ✓容差内'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 影响材料 */}
      <div className="detail-section">
        <h4>影响材料</h4>
        {point.materials?.length ? (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {point.materials.map(m => (
              <span key={m} className="badge badge-low" style={{ padding: '3px 10px' }}>
                {m}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: '12px' }}>暂无关联材料</div>
        )}
      </div>

      {/* 异常说明 */}
      <div className="detail-section">
        <h4>异常说明</h4>
        <p>{point.anomalyNote || '暂无异常'}</p>
      </div>

      {/* 追溯链路 */}
      {traces.length > 0 && (
        <div className="detail-section">
          <h4>追溯链路</h4>
          <div className="timeline">
            {traces.map((t, idx) => (
              <div
                key={t.step}
                className={`timeline-item ${idx === traces.length - 1 ? 'danger' : ''}`}
              >
                <div className="timeline-dot" />
                <div>
                  <div className="timeline-step">
                    步骤 {t.step}：{t.from} → {t.to}
                    <span className="timeline-time">{t.time}</span>
                  </div>
                  <div className="timeline-body">{t.reason}</div>
                  {t.operator && (
                    <div className="timeline-time" style={{ marginTop: '2px' }}>
                      操作人：{t.operator}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnomalyDetail;
