import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import api, { getSeverityBadgeClass, getStatusBadgeClass } from '../utils/api';

const Defects = () => {
  const [defects, setDefects] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [defectsRes, statsRes] = await Promise.all([
        api.get('/api/defects/statistics'),
        api.get('/api/reports/quarantine-status')
      ]);
      setStats(defectsRes.data);
      setDefects(statsRes.data.records || []);
    } catch (err) {
      console.error('加载缺陷数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem' }}>正在加载...</p>
      </div>
    );
  }

  const maxValue = Math.max(...stats.map(s => s.total_quantity), 1);

  return (
    <div>
      <div className="page-header">
        <h2>缺陷管理</h2>
      </div>

      <div className="card">
        <h3 className="card-title">缺陷分布统计</h3>
        {stats.length > 0 ? (
          <div className="bar">
            {stats.map((item, idx) => {
              const height = (item.total_quantity / maxValue) * 150;
              return (
                <div key={idx} className="bar-item">
                  <div className="bar-value">{item.total_quantity}</div>
                  <div 
                    className="bar-bar" 
                    style={{ 
                      height: `${height}px`,
                      background: item.severity === '严重' ? '#ef4444' : 
                                 item.severity === '轻微' ? '#10b981' : '#f59e0b'
                    }}
                  ></div>
                  <div className="bar-label">{item.defect_type}</div>
                  <div className="bar-label">
                    <span className={`status-badge ${getSeverityBadgeClass(item.severity)}`}>
                      {item.severity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">暂无缺陷数据</div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ marginBottom: 0 }}>隔离库存状态</h3>
        </div>
        <div className="table-container" style={{ marginTop: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>批次号</th>
                <th>产品名称</th>
                <th>批次数量</th>
                <th>隔离数量</th>
                <th>原因</th>
                <th>隔离人</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {defects.length > 0 ? (
                defects.map(q => (
                  <tr key={q.id}>
                    <td><strong>{q.batch_no}</strong></td>
                    <td>{q.product_name}</td>
                    <td>{q.batch_quantity}</td>
                    <td style={{ color: q.quantity > 0 ? '#dc2626' : 'inherit' }}>
                      {q.quantity}
                    </td>
                    <td>{q.reason || '-'}</td>
                    <td>{q.quarantined_by || '-'}</td>
                    <td>
                      <span className={`status-badge ${q.status === '隔离中' ? 'status-danger' : 'status-success'}`}>
                        {q.status}
                      </span>
                    </td>
                    <td>
                      <Link to={`/batches/${q.batch_id}`} className="btn btn-secondary btn-sm">
                        详情 <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    暂无隔离记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">缺陷严重程度说明</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div className="batch-info">
            <span className="status-badge severity-minor">轻微</span>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              不影响功能，外观瑕疵
            </div>
          </div>
          <div className="batch-info">
            <span className="status-badge severity-medium">一般</span>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              轻微功能影响，可修复
            </div>
          </div>
          <div className="batch-info">
            <span className="status-badge severity-major">严重</span>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              功能失效，需返工
            </div>
          </div>
          <div className="batch-info">
            <span className="status-badge severity-critical">致命</span>
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              安全隐患，需报废
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Defects;
