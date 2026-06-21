import React, { useState } from 'react';
import { ACTION_DEFS } from '../data/mockData';

const ActionPanel = ({ point, onActionDone }) => {
  const [doneActions, setDoneActions] = useState({});

  if (!point) {
    return <div className="empty">请在平面图上选择一个测点查看处置动作</div>;
  }

  const actions = point.actionItems || [];

  const toggleDone = (actionName) => {
    setDoneActions(prev => ({ ...prev, [actionName]: !prev[actionName] }));
  };

  return (
    <div style={{ padding: '14px 16px' }}>
      <div className="tip-box">
        🎯 坐标偏移影响结果时，需要落到人能继续处理的动作上。
      </div>

      {actions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#059669', fontSize: '13px' }}>
          ✓ 当前测点无待处理动作
        </div>
      ) : (
        <div>
          <h4 style={{
            fontSize: '12px', fontWeight: '600', color: '#374151',
            marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            待处理动作 ({actions.filter(a => !doneActions[a]).length}/{actions.length})
          </h4>

          {actions.map(actionName => {
            const def = ACTION_DEFS[actionName] || { icon: '📌', desc: '-', owner: '-', warnLevel: 'info' };
            const isDone = !!doneActions[actionName];

            return (
              <div
                key={actionName}
                className={`action-item ${def.warnLevel}`}
                style={{
                  opacity: isDone ? 0.5 : 1,
                  textDecoration: isDone ? 'line-through' : 'none',
                }}
              >
                <div className="action-icon">{def.icon}</div>
                <div className="action-content">
                  <div className="action-title">
                    {actionName}
                    {isDone && <span style={{ color: '#059669', marginLeft: '8px', fontSize: '11px' }}>
                      ✓ 已完成
                    </span>}
                  </div>
                  <div className="action-desc">{def.desc}</div>
                  <div className="action-owner">👤 {def.owner}</div>
                  <div className="action-btn-row">
                    <button
                      className={`btn btn-sm ${isDone ? '' : 'btn-primary'}`}
                      onClick={() => toggleDone(actionName)}
                    >
                      {isDone ? '撤销完成' : '标记完成'}
                    </button>
                    <button className="btn btn-sm">查看详情</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 快速添加动作 */}
      <div style={{
        marginTop: '16px',
        paddingTop: '14px',
        borderTop: '1px solid #e5e7eb',
      }}>
        <h4 style={{
          fontSize: '12px', fontWeight: '600', color: '#6b7280',
          marginBottom: '8px',
        }}>
          ➕ 追加动作
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Object.keys(ACTION_DEFS).filter(a => !actions.includes(a) && !doneActions[a]).map(a => (
            <button
              key={a}
              className="btn btn-sm"
              onClick={() => {
                point.actionItems = [...(point.actionItems || []), a];
                onActionDone && onActionDone();
              }}
            >
              + {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActionPanel;
