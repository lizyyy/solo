import React from 'react';
import { Link } from 'react-router-dom';
import { Batch, RiskAssessment } from '../types';
import { riskApi } from '../api';

interface DashboardProps {
  batches: Batch[];
  onRefresh: () => void;
}

function Dashboard({ batches, onRefresh }: DashboardProps) {
  const [riskAssessments, setRiskAssessments] = React.useState<RiskAssessment[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadRiskAssessments();
  }, [batches]);

  const loadRiskAssessments = async () => {
    try {
      const data = await riskApi.getAll();
      setRiskAssessments(data);
    } catch (error) {
      console.error('Failed to load risk assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: batches.length,
    withDeltaE: batches.filter(b => b.deltaE !== undefined).length,
    highRisk: riskAssessments.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length,
    pendingReview: riskAssessments.filter(r => r.reworkPriority >= 25).length
  };

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'low': return 'risk-badge risk-low';
      case 'medium': return 'risk-badge risk-medium';
      case 'high': return 'risk-badge risk-high';
      case 'critical': return 'risk-badge risk-critical';
      default: return 'risk-badge';
    }
  };

  const getRiskText = (level: string) => {
    switch (level) {
      case 'low': return '低风险';
      case 'medium': return '中风险';
      case 'high': return '高风险';
      case 'critical': return '极严重';
      default: return level;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">仪表盘</h1>
        <button className="btn btn-secondary" onClick={onRefresh}>
          🔄 刷新数据
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">总批次数量</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-icon">📦</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已测色色差</div>
          <div className="stat-value">{stats.withDeltaE}</div>
          <div className="stat-icon">🎨</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">高风险批次</div>
          <div className="stat-value">{stats.highRisk}</div>
          <div className="stat-icon">⚠️</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">待复核批次</div>
          <div className="stat-value">{stats.pendingReview}</div>
          <div className="stat-icon">📋</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">风险队列概览</h2>
          <Link to="/risk-queue" className="btn btn-sm btn-primary">
            查看全部 →
          </Link>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading">加载中...</div>
          ) : riskAssessments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-text">暂无批次数据</div>
              <div className="empty-state-hint">请先导入批次数据</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>批次号</th>
                    <th>客户</th>
                    <th>DeltaE</th>
                    <th>温度偏差</th>
                    <th>漏加助剂</th>
                    <th>返工优先级</th>
                    <th>风险等级</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {riskAssessments.slice(0, 10).map((item) => (
                    <tr key={item.batchId}>
                      <td>
                        <Link to={`/batch/${item.batchId}`} style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}>
                          {item.batchNumber}
                        </Link>
                      </td>
                      <td>{item.customerName}</td>
                      <td>
                        {item.deltaE > 0 ? (
                          <span style={{ color: item.deltaE > 3 ? 'var(--danger-color)' : 'inherit' }}>
                            {item.deltaE.toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {item.temperatureDeviation > 0 ? (
                          <span>
                            {item.temperatureDeviation.toFixed(2)}°C
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {item.missingChemicalsCount > 0 ? (
                          <span className="risk-badge risk-high">{item.missingChemicalsCount} 种</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>无</span>
                        )}
                      </td>
                      <td>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem' 
                        }}>
                          <div style={{ 
                            width: '80px', 
                            height: '8px', 
                            background: 'var(--bg-color)', 
                            borderRadius: '4px', 
                            overflow: 'hidden' 
                          }}>
                            <div style={{ 
                              width: `${item.reworkPriority}%`, 
                              height: '100%', 
                              background: item.reworkPriority >= 75 ? 'var(--critical-color)' : 
                                         item.reworkPriority >= 50 ? 'var(--danger-color)' : 
                                         item.reworkPriority >= 25 ? 'var(--warning-color)' : 
                                         'var(--success-color)'
                            }} />
                          </div>
                          <span>{item.reworkPriority}</span>
                        </div>
                      </td>
                      <td>
                        <span className={getRiskBadgeClass(item.riskLevel)}>
                          {getRiskText(item.riskLevel)}
                        </span>
                      </td>
                      <td>
                        <Link to={`/batch/${item.batchId}`} className="btn btn-sm btn-secondary">
                          详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {batches.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">最近批次</h2>
          </div>
          <div className="card-body">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>批次号</th>
                    <th>面料类型</th>
                    <th>客户</th>
                    <th>目标色 (Lab)</th>
                    <th>测量色 (Lab)</th>
                    <th>DeltaE</th>
                    <th>导入时间</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.slice(0, 5).map((batch) => (
                    <tr key={batch.id}>
                      <td>
                        <Link to={`/batch/${batch.id}`} style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}>
                          {batch.batchNumber}
                        </Link>
                      </td>
                      <td>{batch.fabricType}</td>
                      <td>{batch.customerName}</td>
                      <td>
                        <span style={{ fontSize: '0.875rem' }}>
                          L:{batch.targetColor.L.toFixed(1)} 
                          a:{batch.targetColor.a.toFixed(1)} 
                          b:{batch.targetColor.b.toFixed(1)}
                        </span>
                      </td>
                      <td>
                        {batch.measuredColor ? (
                          <span style={{ fontSize: '0.875rem' }}>
                            L:{batch.measuredColor.L.toFixed(1)} 
                            a:{batch.measuredColor.a.toFixed(1)} 
                            b:{batch.measuredColor.b.toFixed(1)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {batch.deltaE !== undefined ? (
                          <span style={{ 
                            color: batch.deltaE > 3 ? 'var(--danger-color)' : 
                                   batch.deltaE > 1 ? 'var(--warning-color)' : 
                                   'var(--success-color)',
                            fontWeight: 600
                          }}>
                            {batch.deltaE.toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {new Date(batch.createdAt).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
