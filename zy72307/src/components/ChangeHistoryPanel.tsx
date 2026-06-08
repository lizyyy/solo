import React from 'react';
import { ChangeHistoryEntry } from '../types';

interface ChangeHistoryPanelProps {
  history: ChangeHistoryEntry[];
}

const fieldLabels: Record<string, string> = {
  originalValue: '原始值',
  status: '状态',
  notes: '备注'
};

const statusLabels: Record<string, string> = {
  pending: '待处理',
  normal: '正常',
  warning: '警告',
  error: '错误',
  needs_review: '待复核'
};

function displayValue(field: string, val: string): string {
  if (field === 'status') {
    return statusLabels[val] || val;
  }
  return val;
}

export const ChangeHistoryPanel: React.FC<ChangeHistoryPanelProps> = ({ history }) => {
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );

  return (
    <div className="history-panel">
      <h3>变更历史 ({sortedHistory.length} 条)</h3>
      {sortedHistory.length === 0 ? (
        <p className="no-history">暂无变更记录</p>
      ) : (
        <div className="history-list">
          {sortedHistory.map((h) => (
            <div key={h.id} className="history-item">
              <div className="history-header">
                <span className="history-criterion">{h.criterionName}</span>
                <span className="history-field">{fieldLabels[h.field] || h.field}</span>
                <span className="history-time">{new Date(h.changedAt).toLocaleString()}</span>
              </div>
              <div className="history-body">
                <div className="history-change">
                  <span className="old-val" title="变更前">{displayValue(h.field, h.oldValue)}</span>
                  <span className="arrow">→</span>
                  <span className="new-val" title="变更后">{displayValue(h.field, h.newValue)}</span>
                </div>
                {h.reason && (
                  <div className="history-reason">原因：{h.reason}</div>
                )}
                <div className="history-by">操作人：{h.changedBy}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
