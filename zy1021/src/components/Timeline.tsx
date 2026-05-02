import React from 'react';
import { SyncLogEntry } from '../types';
import { useAppContext } from '../context/AppContext';
import { formatTimestamp } from '../utils';
import './Timeline.css';

const typeLabels: Record<string, string> = {
  change: '修改',
  sync: '同步',
  conflict: '冲突',
  resolve: '解决'
};

const typeColors: Record<string, { bg: string; color: string }> = {
  change: { bg: '#dbeafe', color: '#1d4ed8' },
  sync: { bg: '#d1fae5', color: '#047857' },
  conflict: { bg: '#fee2e2', color: '#dc2626' },
  resolve: { bg: '#fef3c7', color: '#d97706' }
};

const deviceColors: Record<string, string> = {
  'device-1': '#3b82f6',
  'device-2': '#8b5cf6',
  'system': '#6b7280'
};

export const Timeline: React.FC = () => {
  const { state } = useAppContext();

  const sortedLogs = [...state.logs].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h3>同步时间线</h3>
        <div className="timeline-stats">
          <span>总日志数: {state.logs.length}</span>
          <span>未解决冲突: {state.server.conflicts.filter(c => !c.resolved).length}</span>
        </div>
      </div>

      <div className="timeline-content">
        {sortedLogs.length === 0 ? (
          <div className="timeline-empty">
            <p>暂无同步记录</p>
          </div>
        ) : (
          <div className="timeline-list">
            {sortedLogs.map((log, index) => (
              <TimelineItem key={log.id} log={log} isFirst={index === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface TimelineItemProps {
  log: SyncLogEntry;
  isFirst: boolean;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ log, isFirst }) => {
  const colors = typeColors[log.type] || typeColors.change;
  const deviceColor = deviceColors[log.deviceId] || deviceColors['system'];

  return (
    <div className={`timeline-item ${isFirst ? 'first' : ''}`}>
      <div className="timeline-left">
        <div
          className="timeline-dot"
          style={{ backgroundColor: colors.color }}
        ></div>
        {!isFirst && <div className="timeline-line"></div>}
      </div>

      <div className="timeline-right">
        <div className="timeline-badge-row">
          <span
            className="timeline-type-badge"
            style={{ backgroundColor: colors.bg, color: colors.color }}
          >
            {typeLabels[log.type] || log.type}
          </span>
          <span
            className="timeline-device-badge"
            style={{ backgroundColor: deviceColor + '20', color: deviceColor }}
          >
            {log.deviceId === 'system' ? '系统' : log.deviceId}
          </span>
        </div>

        <div className="timeline-description">
          {log.description}
        </div>

        <div className="timeline-meta">
          <span className="timeline-user">操作用户: {log.userId}</span>
          <span className="timeline-time">{formatTimestamp(log.timestamp)}</span>
        </div>

        {log.details && Object.keys(log.details).length > 0 && (
          <details className="timeline-details">
            <summary>查看详情</summary>
            <pre className="timeline-details-content">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};
