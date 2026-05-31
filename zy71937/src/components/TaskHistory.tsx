import React from 'react';
import { TaskHistory } from '../types';
import { formatDate } from '../utils/helpers';

interface TaskHistoryProps {
  history: TaskHistory[];
}

const TaskHistoryPanel: React.FC<TaskHistoryProps> = ({ history }) => {
  const sortedHistory = [...history].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getActionColor = (action: string): string => {
    const colors: Record<string, string> = {
      '创建': '#3b82f6',
      '编辑': '#6b7280',
      '提交审核': '#f59e0b',
      '确认': '#10b981',
      '导出': '#0ea5e9',
      '撤回': '#ef4444',
      '状态变更': '#8b5cf6',
      '异常处理': '#f97316',
      '规格更新': '#14b8a6',
      '导入': '#ec4899',
    };
    return colors[action] || '#6b7280';
  };

  return (
    <div className="history-panel">
      <h3>操作历史</h3>
      <div className="history-timeline">
        {sortedHistory.map((record, index) => (
          <div key={record.id} className="history-item">
            <div className="history-marker">
              <span 
                className="action-dot"
                style={{ backgroundColor: getActionColor(record.action) }}
              />
              {index < sortedHistory.length - 1 && <div className="timeline-line" />}
            </div>
            <div className="history-content">
              <div className="history-header">
                <span className="action-label">{record.action}</span>
                <span className="history-time">{formatDate(record.timestamp)}</span>
              </div>
              <div className="history-desc">{record.description}</div>
              <div className="history-operator">操作人: {record.operator}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskHistoryPanel;
