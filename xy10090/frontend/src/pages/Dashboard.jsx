import { useState, useEffect } from 'react';
import { invoices, STATUS_MAP, EXCEPTION_TYPE_MAP } from '../api';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await invoices.stats();
      setStats(res.data);
    } catch (err) {
      console.error('加载统计失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="empty-state">加载中...</div>;
  }

  const overview = stats?.overview || {};

  const exceptionTypeLabels = {
    amount_mismatch: '金额不匹配',
    tax_number_invalid: '税号无效',
    approval_missing: '审批缺失',
    other: '其他异常'
  };

  const exceptionData = stats?.exceptionByType || [];
  const maxExceptionCount = exceptionData.reduce((max, e) => Math.max(max, e.count), 0) || 1;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">工作台</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-label">票据总数</div>
          <div className="stat-value">{overview.total || 0}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">待处理</div>
          <div className="stat-value">
            {(overview.pending || 0) + (overview.reviewing || 0)}
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">异常票据</div>
          <div className="stat-value">{overview.withExceptions || 0}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">已完成</div>
          <div className="stat-value">{(overview.approved || 0) + (overview.rejected || 0)}</div>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {Object.entries(STATUS_MAP).map(([key, val]) => (
          <div className="stat-card" key={key}>
            <div className="stat-label">{val.label}</div>
            <div className="stat-value" style={{ fontSize: '22px' }}>
              {overview[key] || 0}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div className="card-title">金额统计</div>
        </div>
        <div className="card-body">
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 0 }}>
            <div className="stat-card" style={{ boxShadow: 'none', padding: 0 }}>
              <div className="stat-label">总金额</div>
              <div className="stat-value" style={{ color: '#2563eb' }}>
                ¥{(overview.totalAmount || 0).toLocaleString()}
              </div>
            </div>
            <div className="stat-card" style={{ boxShadow: 'none', padding: 0 }}>
              <div className="stat-label">总税额</div>
              <div className="stat-value">
                ¥{(overview.totalTaxAmount || 0).toLocaleString()}
              </div>
            </div>
            <div className="stat-card" style={{ boxShadow: 'none', padding: 0 }}>
              <div className="stat-label">价税合计</div>
              <div className="stat-value" style={{ color: '#16a34a' }}>
                ¥{((overview.totalAmount || 0) + (overview.totalTaxAmount || 0)).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="chart-container">
            <div className="stat-label" style={{ marginBottom: '12px' }}>审核进度</div>
            <div className="progress-bar" style={{ height: '20px', borderRadius: '10px' }}>
              <div
                className="progress-fill"
                style={{
                  width: `${overview.total > 0
                    ? Math.round(
                        ((overview.approved || 0) / overview.total) * 100
                      )
                    : 0}%`
                }}
              />
            </div>
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
              通过率:{' '}
              {overview.total > 0
                ? Math.round(
                    ((overview.approved || 0) / overview.total) * 100
                  )
                : 0}
              %
            </div>
          </div>
        </div>
      </div>

      {exceptionData.length > 0 && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <div className="card-title">异常类型分布</div>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <div className="chart-bars">
                {exceptionData.map((e) => (
                  <div
                    key={e.type}
                    className="chart-bar"
                    style={{
                      height: `${(e.count / maxExceptionCount) * 100}%`,
                      background: e.type === 'amount_mismatch'
                        ? '#dc2626'
                        : e.type === 'approval_missing'
                        ? '#f59e0b'
                        : '#2563eb'
                    }}
                    title={`${exceptionTypeLabels[e.type] || EXCEPTION_TYPE_MAP[e.type] || e.type}: ${e.count}`}
                  />
                ))}
              </div>
              <div className="chart-labels">
                {exceptionData.map((e) => (
                  <div key={e.type} className="chart-label">
                    {exceptionTypeLabels[e.type] || EXCEPTION_TYPE_MAP[e.type] || e.type}
                    <div style={{ fontWeight: '600', color: '#374151', marginTop: '2px' }}>
                      {e.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
