import React, { useState, useEffect } from 'react';
import { anomalyApi, propertyApi } from '../services/api';
import { 
  formatDateTime, 
  getAnomalyTypeLabel,
  getAnomalySeverityBadge
} from '../utils/helpers';

function Anomalies() {
  const [anomalies, setAnomalies] = useState([]);
  const [properties, setProperties] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      const [anomaliesRes, propertiesRes] = await Promise.all([
        filter === 'all' 
          ? anomalyApi.getAll() 
          : anomalyApi.getAll({ resolved: filter === 'resolved' ? 'true' : 'false' }),
        propertyApi.getAll()
      ]);
      setAnomalies(anomaliesRes.data);
      setProperties(propertiesRes.data);
    } catch (error) {
      console.error('加载异常数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPropertyName = (propertyId) => {
    const property = properties.find(p => p.id === propertyId);
    return property ? property.name : propertyId;
  };

  const handleResolve = async () => {
    if (!selectedAnomaly) return;

    try {
      await anomalyApi.resolve(selectedAnomaly.id, resolution || '人工处理完成');
      setMessage({ type: 'success', text: '异常已标记为已解决' });
      setShowResolveModal(false);
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: '处理失败' });
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>⚠️ 异常提醒</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setFilter('all')}
          >
            全部
          </button>
          <button 
            className={`btn ${filter === 'pending' ? 'btn-warning' : 'btn-secondary'} btn-sm`}
            onClick={() => setFilter('pending')}
          >
            待处理
          </button>
          <button 
            className={`btn ${filter === 'resolved' ? 'btn-success' : 'btn-secondary'} btn-sm`}
            onClick={() => setFilter('resolved')}
          >
            已解决
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <h3 className="card-title">异常类型说明</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div className="alert alert-danger">
            <h4>🔴 过期密码尝试访问</h4>
            <p className="text-sm">系统检测到已过期的密码被尝试使用。可能是客人在退房后仍试图进入房间。</p>
            <p className="text-sm mt-4"><strong>处理方式：</strong>系统自动拦截并记录，建议联系客人确认情况。</p>
          </div>
          <div className="alert alert-warning">
            <h4>🟠 维修密码越权访问</h4>
            <p className="text-sm">维修密码在房源非维修状态下被尝试使用。可能存在安全风险。</p>
            <p className="text-sm mt-4"><strong>处理方式：</strong>系统自动拦截，建议检查是否有 unauthorized 访问。</p>
          </div>
        </div>
      </div>

      {anomalies.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>✅ 暂无异常记录</p>
            <p className="text-sm">系统运行正常，所有密码访问都在授权范围内。</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <h3 className="card-title">异常记录 ({anomalies.length} 条)</h3>
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>房源</th>
                <th>异常类型</th>
                <th>严重程度</th>
                <th>描述</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map(anomaly => {
                const severityBadge = getAnomalySeverityBadge(anomaly.severity);
                return (
                  <tr key={anomaly.id}>
                    <td className="text-sm">{formatDateTime(anomaly.timestamp)}</td>
                    <td>{getPropertyName(anomaly.propertyId)}</td>
                    <td>{getAnomalyTypeLabel(anomaly.type)}</td>
                    <td>
                      <span className={`badge ${severityBadge.class}`}>{severityBadge.label}</span>
                    </td>
                    <td className="text-sm">{anomaly.description}</td>
                    <td>
                      <span className={`badge ${anomaly.resolved ? 'badge-success' : 'badge-warning'}`}>
                        {anomaly.resolved ? '已解决' : '待处理'}
                      </span>
                    </td>
                    <td>
                      {!anomaly.resolved && (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setSelectedAnomaly(anomaly);
                            setResolution('');
                            setShowResolveModal(true);
                          }}
                        >
                          标记解决
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showResolveModal && selectedAnomaly && (
        <div className="modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>处理异常</h3>
              <button className="modal-close" onClick={() => setShowResolveModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info">
                <p><strong>异常类型：</strong>{getAnomalyTypeLabel(selectedAnomaly.type)}</p>
                <p><strong>发生时间：</strong>{formatDateTime(selectedAnomaly.timestamp)}</p>
                <p><strong>描述：</strong>{selectedAnomaly.description}</p>
              </div>

              <div className="form-group mt-4">
                <label className="form-label">处理说明（可选）</label>
                <textarea 
                  className="form-input"
                  rows="3"
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                  placeholder="请输入处理说明..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowResolveModal(false)}
              >
                取消
              </button>
              <button 
                className="btn btn-success" 
                onClick={handleResolve}
              >
                确认解决
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Anomalies;
