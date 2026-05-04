import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RiskAssessment } from '../types';
import { riskApi, exportApi } from '../api';

function RiskQueue() {
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    loadRiskAssessments();
  }, []);

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

  const handleExportRiskList = async () => {
    await exportApi.downloadRiskList();
  };

  const filteredAssessments = riskAssessments.filter(item => {
    if (filter === 'all') return true;
    return item.riskLevel === filter;
  });

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

  const stats = {
    total: riskAssessments.length,
    critical: riskAssessments.filter(r => r.riskLevel === 'critical').length,
    high: riskAssessments.filter(r => r.riskLevel === 'high').length,
    medium: riskAssessments.filter(r => r.riskLevel === 'medium').length,
    low: riskAssessments.filter(r => r.riskLevel === 'low').length
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">风险队列</h1>
        <button className="btn btn-primary" onClick={handleExportRiskList}>
          📥 导出风险清单
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">总批次</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-icon">📦</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">极严重</div>
          <div className="stat-value" style={{ color: 'var(--critical-color)' }}>{stats.critical}</div>
          <div className="stat-icon">🔴</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">高风险</div>
          <div className="stat-value" style={{ color: 'var(--danger-color)' }}>{stats.high}</div>
          <div className="stat-icon">🟠</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">中风险</div>
          <div className="stat-value" style={{ color: 'var(--warning-color)' }}>{stats.medium}</div>
          <div className="stat-icon">🟡</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">风险批次列表</h2>
          <div className="btn-group">
            <button 
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter('all')}
            >
              全部
            </button>
            <button 
              className={`btn btn-sm ${filter === 'critical' ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => setFilter('critical')}
            >
              极严重 ({stats.critical})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'high' ? 'btn-warning' : 'btn-secondary'}`}
              onClick={() => setFilter('high')}
            >
              高风险 ({stats.high})
            </button>
            <button 
              className={`btn btn-sm ${filter === 'medium' ? 'btn-secondary' : 'btn-secondary'}`}
              onClick={() => setFilter('medium')}
            >
              中风险 ({stats.medium})
            </button>
          </div>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading">加载中...</div>
          ) : filteredAssessments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-text">
                {filter === 'all' ? '暂无批次数据' : `暂无${getRiskText(filter)}批次`}
              </div>
              <div className="empty-state-hint">
                {filter === 'all' ? '请先导入批次数据' : '所有批次风险等级较低'}
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>优先级</th>
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
                  {filteredAssessments.map((item, index) => (
                    <tr key={item.batchId}>
                      <td>
                        <span style={{ 
                          fontSize: '1.25rem', 
                          fontWeight: 700,
                          color: item.riskLevel === 'critical' || item.riskLevel === 'high' 
                            ? 'var(--danger-color)' 
                            : 'var(--text-color)'
                        }}>
                          #{index + 1}
                        </span>
                      </td>
                      <td>
                        <Link 
                          to={`/batch/${item.batchId}`} 
                          style={{ 
                            color: 'var(--primary-color)', 
                            textDecoration: 'none', 
                            fontWeight: 500 
                          }}
                        >
                          {item.batchNumber}
                        </Link>
                      </td>
                      <td>{item.customerName}</td>
                      <td>
                        {item.deltaE > 0 ? (
                          <span style={{ 
                            color: item.deltaE > 5 ? 'var(--danger-color)' : 
                                   item.deltaE > 3 ? 'var(--warning-color)' : 
                                   'inherit'
                          }}>
                            {item.deltaE.toFixed(2)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {item.temperatureDeviation > 0 ? (
                          <span style={{ 
                            color: item.temperatureDeviation > 10 ? 'var(--danger-color)' : 
                                   item.temperatureDeviation > 5 ? 'var(--warning-color)' : 
                                   'inherit'
                          }}>
                            {item.temperatureDeviation.toFixed(2)}°C
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {item.missingChemicalsCount > 0 ? (
                          <span className="risk-badge risk-high">
                            {item.missingChemicalsCount} 种
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>无</span>
                        )}
                      </td>
                      <td>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem' 
                        }}>
                          <div style={{ 
                            width: '100px', 
                            height: '10px', 
                            background: 'var(--bg-color)', 
                            borderRadius: '5px', 
                            overflow: 'hidden' 
                          }}>
                            <div style={{ 
                              width: `${item.reworkPriority}%`, 
                              height: '100%', 
                              background: item.reworkPriority >= 75 ? 'var(--critical-color)' : 
                                         item.reworkPriority >= 50 ? 'var(--danger-color)' : 
                                         item.reworkPriority >= 25 ? 'var(--warning-color)' : 
                                         'var(--success-color)',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                          <span style={{ 
                            fontWeight: 600,
                            minWidth: '40px',
                            textAlign: 'right'
                          }}>
                            {item.reworkPriority}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={getRiskBadgeClass(item.riskLevel)}>
                          {getRiskText(item.riskLevel)}
                        </span>
                      </td>
                      <td>
                        <Link 
                          to={`/batch/${item.batchId}`} 
                          className="btn btn-sm btn-primary"
                        >
                          查看详情
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

      {filteredAssessments.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">风险等级说明</h2>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <div style={{ padding: '1rem', background: '#dcfce7', borderRadius: '8px' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🟢 低风险 (0-24分)</div>
                <div style={{ fontSize: '0.875rem', color: '#166534' }}>
                  DeltaE ≤ 1，无温度偏差，无助剂漏加
                </div>
              </div>
              <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🟡 中风险 (25-49分)</div>
                <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
                  DeltaE 1-3 或 轻度温度偏差
                </div>
              </div>
              <div style={{ padding: '1rem', background: '#fee2e2', borderRadius: '8px' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🟠 高风险 (50-74分)</div>
                <div style={{ fontSize: '0.875rem', color: '#991b1b' }}>
                  DeltaE 3-5 或 中度温度偏差 或 1种助剂漏加
                </div>
              </div>
              <div style={{ padding: '1rem', background: '#7f1d1d', borderRadius: '8px', color: '#fef2f2' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>🔴 极严重 (75-100分)</div>
                <div style={{ fontSize: '0.875rem', color: '#fecaca' }}>
                  DeltaE > 5 或 严重温度偏差 或 2种以上助剂漏加
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RiskQueue;
