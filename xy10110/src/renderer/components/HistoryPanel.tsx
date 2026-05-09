import React from 'react';
import { HistoryRecord } from '../../shared/types';

interface Props {
  history: HistoryRecord[];
}

const HistoryPanel: React.FC<Props> = ({ history }) => {
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionIcon = (action: string): string => {
    if (action.includes('创建')) return '➕';
    if (action.includes('更新')) return '✏️';
    if (action.includes('删除')) return '🗑️';
    if (action.includes('复核')) return '✅';
    if (action.includes('交付')) return '🚀';
    if (action.includes('导出')) return '📄';
    return '📋';
  };

  return (
    <div className="history-list">
      {history.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📜</div>
          <p>暂无历史记录</p>
          <p style={{ marginTop: 8, fontSize: 12 }}>您的操作记录将显示在这里</p>
        </div>
      ) : (
        history.map(record => (
          <div key={record.id} className="history-item">
            <div className="history-time">{formatTime(record.timestamp)}</div>
            <div style={{ fontSize: 18 }}>{getActionIcon(record.action)}</div>
            <div className="history-content">
              <div className="history-action">
                {record.action} - {record.itemName}
              </div>
              <div className="history-details">{record.details}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default HistoryPanel;
