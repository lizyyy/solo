import React, { useState } from 'react';
import { MATERIAL_HISTORY } from '../data/mockData';

const MaterialHistory = ({ point }) => {
  const [expanded, setExpanded] = useState({});

  if (!point) {
    return <div className="empty">请在平面图上选择一个测点查看材料送审历史</div>;
  }

  const materials = point.materials || [];
  if (materials.length === 0) {
    return <div className="empty">该测点暂无关联材料送审记录</div>;
  }

  const toggle = (name) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div style={{ padding: '14px 16px' }}>
      <div className="tip-box">
        💡 材料送审表保留所有版本历史，包含备注和旧截图，不只是最终值。
      </div>

      {materials.map(materialName => {
        const versions = MATERIAL_HISTORY[materialName] || [];
        const current = versions.find(v => v.isCurrent);
        const history = versions.filter(v => !v.isCurrent).sort((a, b) => b.version - a.version);
        const isExpanded = expanded[materialName];

        return (
          <div key={materialName} className="material-card">
            <div className="material-head">
              <div className="material-name">{materialName}</div>
              {current && (
                <span className="badge badge-ok">当前 v{current.version}</span>
              )}
            </div>

            <div className="material-body">
              <div className="row">
                <span className="k">规格：</span>
                <span>{current?.specification || '-'}</span>
              </div>
              <div className="row">
                <span className="k">供应商：</span>
                <span>{current?.supplier || '-'}</span>
              </div>
              <div className="row">
                <span className="k">送审人：</span>
                <span>{current?.submittedBy || '-'}</span>
              </div>
              <div className="row">
                <span className="k">更新时间：</span>
                <span>{current?.createdAt?.slice(0, 16).replace('T', ' ') || '-'}</span>
              </div>

              {current?.remark && (
                <div className="material-remark">
                  📝 备注：{current.remark}
                </div>
              )}

              {current?.screenshotUrl && (
                <div className="material-screenshot">
                  🖼️ {materialName} v{current.version} 截图（占位）
                </div>
              )}
            </div>

            {history.length > 0 && (
              <>
                <div
                  style={{
                    padding: '8px 14px',
                    background: '#f9fafb',
                    borderTop: '1px solid #e5e7eb',
                    fontSize: '12px',
                    color: '#6b7280',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggle(materialName)}
                >
                  {isExpanded ? '▼' : '▶'} 历史版本（{history.length} 个旧版本）
                </div>
                {isExpanded && (
                  <div className="history-list">
                    {history.map(h => (
                      <div key={h.id} className="history-item">
                        <div className="hist-title">
                          <span className="badge badge-mid">v{h.version}</span>
                          {' '}· {h.submittedBy} · {h.createdAt?.slice(0, 16).replace('T', ' ')}
                        </div>
                        <div>规格：{h.specification || '-'}</div>
                        <div>供应商：{h.supplier || '-'}</div>
                        {h.remark && <div style={{ color: '#b45309' }}>备注：{h.remark}</div>}
                        {h.screenshotUrl && (
                          <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                            🖼️ 旧截图：{h.screenshotUrl}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MaterialHistory;
