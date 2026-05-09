import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { HistoryRecord } from '../types';

const History = () => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const response = await api.history.getAll(200);
    if (response.success) {
      setHistory(response.data as HistoryRecord[]);
    }
    setLoading(false);
  };

  const filteredHistory =
    filterType === 'all'
      ? history
      : history.filter(h => h.entityType === filterType);

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      order: '订单',
      assignment: '派单',
      aunt: '阿姨',
      leave: '请假'
    };
    return labels[type] || type;
  };

  const getTypeClass = (type: string) => {
    const classes: Record<string, string> = {
      order: 'status-tag status-info',
      assignment: 'status-tag status-success',
      aunt: 'status-tag',
      leave: 'status-tag status-warning'
    };
    return classes[type] || 'status-tag';
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create: '创建',
      update: '更新',
      delete: '删除',
      dispatch: '派单',
      approve: '批准',
      reject: '拒绝',
      cancel: '取消',
      reassign: '转派',
      status_change: '状态变更'
    };
    return labels[action] || action;
  };

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📜 历史记录</h1>
        <div className="flex gap-2">
          <select
            className="form-select"
            style={{ width: '150px' }}
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">全部类型</option>
            <option value="order">订单</option>
            <option value="assignment">派单</option>
            <option value="aunt">阿姨</option>
            <option value="leave">请假</option>
          </select>
          <button className="btn btn-default" onClick={loadHistory}>
            刷新
          </button>
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📜</div>
          <div className="empty-text">暂无历史记录</div>
        </div>
      ) : (
        <div className="card">
          {filteredHistory.map(record => (
            <div key={record.id} className="history-item">
              <div className="history-time">
                {new Date(record.timestamp).toLocaleString()}
              </div>
              <div className="history-content">
                <div className="history-action">
                  <span className={getTypeClass(record.entityType)}>
                    {getTypeLabel(record.entityType)}
                  </span>
                  <span style={{ marginLeft: '8px', fontWeight: '500' }}>
                    {getActionLabel(record.action)}
                  </span>
                </div>
                <div className="history-description">{record.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
