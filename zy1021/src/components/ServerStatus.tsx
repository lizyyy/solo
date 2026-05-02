import React from 'react';
import { useAppContext } from '../context/AppContext';
import { formatTimestamp } from '../utils';
import './ServerStatus.css';

export const ServerStatus: React.FC = () => {
  const { state } = useAppContext();

  const latestChange = state.server.changeHistory.length > 0
    ? state.server.changeHistory[state.server.changeHistory.length - 1]
    : null;

  return (
    <div className="server-status-container">
      <div className="server-status-header">
        <h3>服务端状态</h3>
        <div className="server-version">
          <span className="version-label">当前版本:</span>
          <span className="version-number">v{state.server.currentVersion}</span>
        </div>
      </div>

      <div className="server-status-content">
        <div className="server-form-info">
          <h4>当前巡检表</h4>
          <div className="form-meta">
            <span>标题: {state.server.form.title}</span>
            <span>创建时间: {formatTimestamp(state.server.form.createdAt)}</span>
            <span>巡检项数量: {state.server.form.items.length}</span>
          </div>

          <div className="form-items-summary">
            {state.server.form.items.map((item) => (
              <div key={item.id} className="item-summary">
                <span className="item-name">{item.name}</span>
                <div className="item-stats">
                  <span className={`risk-level ${item.riskLevel}`}>
                    {item.riskLevel === 'low' ? '低风险' : item.riskLevel === 'medium' ? '中风险' : '高风险'}
                  </span>
                  <span className={`status ${item.status}`}>
                    {item.status === 'pending' ? '待处理' : item.status === 'in_progress' ? '处理中' : '已完成'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {latestChange && (
          <div className="latest-change">
            <h4>最后一次同步</h4>
            <div className="change-details">
              <div className="change-meta">
                <span>版本: v{latestChange.version}</span>
                <span>修改者: {latestChange.userId}</span>
                <span>{formatTimestamp(latestChange.timestamp)}</span>
              </div>
              <div className="change-content">
                <span>修改了字段: {latestChange.field}</span>
                <span className="change-value">
                  {String(latestChange.oldValue) || '(空)'} → {String(latestChange.newValue) || '(空)'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="server-stats">
          <div className="stat-item">
            <span className="stat-value">{state.server.changeHistory.length}</span>
            <span className="stat-label">历史同步次数</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{state.server.conflicts.length}</span>
            <span className="stat-label">总冲突数</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{state.server.conflicts.filter(c => !c.resolved).length}</span>
            <span className="stat-label">未解决冲突</span>
          </div>
        </div>
      </div>
    </div>
  );
};
