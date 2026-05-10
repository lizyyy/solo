import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { alertsAPI } from '../services/api';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    is_resolved: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await alertsAPI.getAll();
      setAlerts(response.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filters.is_resolved !== '') {
      const filterVal = filters.is_resolved === 'true' ? 1 : 0;
      if (a.is_resolved !== filterVal) return false;
    }
    return true;
  });

  const handleResolve = async (alertId) => {
    try {
      await alertsAPI.resolve(alertId);
      loadData();
    } catch (error) {
      alert('操作失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const getSeverityStyle = (severity) => {
    const styles = {
      danger: { color: '#721c24', background: '#f8d7da' },
      warning: { color: '#856404', background: '#fff3cd' },
      info: { color: '#004085', background: '#cce5ff' }
    };
    return styles[severity] || styles.warning;
  };

  const getSeverityLabel = (severity) => {
    const labels = {
      danger: '紧急',
      warning: '警告',
      info: '提示'
    };
    return labels[severity] || severity;
  };

  const unresolvedCount = alerts.filter(a => !a.is_resolved).length;
  const resolvedCount = alerts.filter(a => a.is_resolved).length;

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '20px' }}>
        <div className="stat-card warning">
          <div className="label">未解决异常</div>
          <div className="value">{unresolvedCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">已解决</div>
          <div className="value">{resolvedCount}</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <label>状态</label>
          <select
            value={filters.is_resolved}
            onChange={(e) => setFilters({ ...filters, is_resolved: e.target.value })}
          >
            <option value="">全部</option>
            <option value="false">未解决</option>
            <option value="true">已解决</option>
          </select>
        </div>
        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-secondary" onClick={loadData}>
            🔄 刷新
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <h3>异常提示列表</h3>
        </div>

        {filteredAlerts.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>住院号</th>
                <th>宠物</th>
                <th>笼位</th>
                <th>类型</th>
                <th>消息</th>
                <th>严重程度</th>
                <th>创建时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map(alert => (
                <tr key={alert.id}>
                  <td>{alert.admission_number || '-'}</td>
                  <td>{alert.pet_name || '-'}</td>
                  <td>{alert.cage_number || '-'}</td>
                  <td>{alert.alert_type}</td>
                  <td>{alert.message}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={getSeverityStyle(alert.severity)}
                    >
                      {getSeverityLabel(alert.severity)}
                    </span>
                  </td>
                  <td>{dayjs(alert.created_at).format('MM-DD HH:mm')}</td>
                  <td>
                    <span className={`status-badge ${alert.is_resolved ? 'status-completed' : 'status-pending'}`}>
                      {alert.is_resolved ? '已解决' : '未解决'}
                    </span>
                  </td>
                  <td>
                    {!alert.is_resolved && (
                      <button
                        className="btn btn-success"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => handleResolve(alert.id)}
                      >
                        解决
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="icon">✅</div>
            <p>暂无异常提示</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Alerts;
