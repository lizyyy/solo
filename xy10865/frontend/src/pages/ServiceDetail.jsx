import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

function ServiceDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchServiceDetail();
  }, [id]);

  const fetchServiceDetail = async () => {
    try {
      const response = await fetch(`/api/services/${id}`);
      const data = await response.json();
      setData(data);
    } catch (error) {
      console.error('Failed to fetch service detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const runHealthCheck = async () => {
    setChecking(true);
    try {
      const response = await fetch(`/api/services/${id}/check`, {
        method: 'POST'
      });
      const result = await response.json();
      console.log('Check result:', result);
      await fetchServiceDetail();
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setChecking(false);
    }
  };

  const fetchReport = async () => {
    try {
      const response = await fetch(`/api/services/${id}/report`);
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Failed to fetch report:', error);
    }
  };

  const downloadReport = () => {
    window.open(`/api/services/${id}/report/csv`, '_blank');
  };

  const triggerDependencyFailure = async (depId, shouldFail) => {
    try {
      await fetch(`/api/dependencies/${depId}/trigger-failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shouldFail })
      });
    } catch (error) {
      console.error('Failed to trigger failure:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'status-healthy';
      case 'degraded': return 'status-degraded';
      case 'unhealthy': return 'status-unhealthy';
      case 'recovering': return 'status-recovering';
      default: return 'status-unknown';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'healthy': return '健康';
      case 'degraded': return '降级';
      case 'unhealthy': return '异常';
      case 'recovering': return '恢复中';
      default: return '未知';
    }
  };

  const getDependencyStatusText = (status) => {
    switch (status) {
      case 'up': return '正常';
      case 'down': return '故障';
      case 'degraded': return '降级';
      default: return '未知';
    }
  };

  const formatTime = (time) => {
    if (!time) return '-';
    return new Date(time).toLocaleString('zh-CN');
  };

  if (loading || !data) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <span>加载中...</span>
      </div>
    );
  }

  const { service, dependencies = [], timeline = [], recentFailures = [], checkItems = [] } = data;

  return (
    <div>
      <Link to="/" className="back-link">
        ← 返回服务列表
      </Link>

      <div className="detail-section service-info-card">
        <div className="section-title">
          📊 {service.name}
          <span className={`status-badge ${getStatusColor(service.status)}`} style={{ marginLeft: 'auto' }}>
            {getStatusText(service.status)}
          </span>
        </div>

        <div className="status-explanation">
          <strong>当前状态说明:</strong> {report?.service.statusExplanation || '正在加载状态说明...'}
        </div>

        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">健康分数</div>
            <div className="info-value" style={{ color: service.healthScore >= 80 ? '#22c55e' : service.healthScore >= 50 ? '#eab308' : '#ef4444' }}>
              {service.healthScore}/100
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">依赖数量</div>
            <div className="info-value">{dependencies.length}</div>
          </div>
          <div className="info-item">
            <div className="info-label">检查项</div>
            <div className="info-value">{checkItems.length}</div>
          </div>
          <div className="info-item">
            <div className="info-label">状态变更次数</div>
            <div className="info-value">{timeline.length}</div>
          </div>
          <div className="info-item">
            <div className="info-label">失败样本</div>
            <div className="info-value">{recentFailures.length}</div>
          </div>
          <div className="info-item">
            <div className="info-label">负责人</div>
            <div className="info-value" style={{ fontSize: 16 }}>👤 {service.owner}</div>
          </div>
        </div>

        <div className="actions-bar" style={{ marginTop: 20 }}>
          <button
            className="btn btn-success"
            onClick={runHealthCheck}
            disabled={checking}
          >
            {checking ? '⏳ 检查中...' : '🔍 执行健康检查'}
          </button>
          <button className="btn btn-primary" onClick={fetchReport}>
            📋 生成健康报告
          </button>
          <button className="btn btn-secondary" onClick={downloadReport}>
            📥 下载 CSV 报告
          </button>
        </div>
      </div>

      <div className="detail-page">
        <div className="detail-section">
          <div className="section-title">🔗 依赖端点 ({dependencies.length})</div>
          {dependencies.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>暂无依赖</p>
          ) : (
            dependencies.map(dep => (
              <div key={dep.id} className="dependency-item">
                <div className="dependency-header">
                  <span className="dependency-name">{dep.name}</span>
                  <span className={`status-badge status-${dep.status === 'up' ? 'healthy' : dep.status}`}>
                    {getDependencyStatusText(dep.status)}
                  </span>
                </div>
                <div className="dependency-url">{dep.url}</div>
                <div className="dependency-meta">
                  <span>连续失败: {dep.consecutiveFailures} 次</span>
                  <span>连续成功: {dep.consecutiveSuccesses} 次</span>
                  <span>检查超时: {dep.timeout}ms</span>
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button
                    className="btn"
                    style={{ background: '#ef4444', color: 'white', padding: '6px 12px', fontSize: 12 }}
                    onClick={() => triggerDependencyFailure(dep.id, true)}
                  >
                    💣 模拟故障
                  </button>
                  <button
                    className="btn"
                    style={{ background: '#22c55e', color: 'white', padding: '6px 12px', fontSize: 12 }}
                    onClick={() => triggerDependencyFailure(dep.id, false)}
                  >
                    ✅ 恢复正常
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="detail-section">
          <div className="section-title">✅ 检查项 ({checkItems.length})</div>
          {checkItems.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>暂无检查项配置</p>
          ) : (
            checkItems.map(item => (
              <div key={item.id} className="dependency-item">
                <div className="dependency-header">
                  <span className="dependency-name">
                    <span style={{ marginRight: 8 }}>
                      {item.type === 'connectivity' ? '🔌' :
                       item.type === 'latency' ? '⏱️' :
                       item.type === 'response_schema' ? '📋' :
                       item.type === 'connection_pool' ? '🔗' :
                       item.type === 'memory_usage' ? '💾' :
                       item.type === 'replication_lag' ? '🔄' :
                       item.type === 'cluster_health' ? '🖥️' :
                       item.type === 'error_rate' ? '📊' :
                       item.type === 'throughput' ? '⚡' :
                       item.type === 'table_lock' ? '🔒' :
                       item.type === 'indexing_latency' ? '📝' : '🔍'}
                    </span>
                    {item.type}
                  </span>
                  <span className={`status-badge ${!item.enabled ? 'status-unknown' : item.lastResult === 'pass' ? 'status-healthy' : 'status-unhealthy'}`}>
                    {!item.enabled ? '已禁用' : item.lastResult ? (item.lastResult === 'pass' ? '通过' : '失败') : '未检查'}
                  </span>
                </div>
                <div className="dependency-url">配置: {JSON.stringify(item.config)}</div>
                <div className="dependency-meta">
                  <span>上次检查: {formatTime(item.lastCheckAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="detail-section">
          <div className="section-title">📈 状态变更时间线</div>
          {timeline.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>暂无状态变更记录</p>
          ) : (
            <div className="timeline">
              {timeline.map((item, idx) => (
                <div key={idx} className="timeline-item">
                  <div className={`timeline-dot timeline-dot-${item.newStatus}`} />
                  <div className="timeline-time">{formatTime(item.timestamp)}</div>
                  <div className="timeline-status">
                    <span className={`status-badge ${getStatusColor(item.oldStatus)}`} style={{ fontSize: 10 }}>
                      {getStatusText(item.oldStatus)}
                    </span>
                    →
                    <span className={`status-badge ${getStatusColor(item.newStatus)}`} style={{ fontSize: 10 }}>
                      {getStatusText(item.newStatus)}
                    </span>
                  </div>
                  <div className="timeline-reason">{item.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="detail-section full-width">
          <div className="section-title">❌ 最近失败样本 ({recentFailures.length})</div>
          {recentFailures.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>暂无失败样本，一切正常！</p>
          ) : (
            recentFailures.map((sample, idx) => {
              const depName = dependencies.find(d => d.id === sample.dependencyId)?.name || '未知依赖';
              return (
                <div key={idx} className="failure-sample">
                  <div className="failure-time">
                    🕒 {formatTime(sample.timestamp)} | {depName}
                  </div>
                  <div className="failure-error">❌ {sample.errorMessage}</div>
                  <div className="failure-meta">
                    <span>状态码: {sample.statusCode || '-'}</span>
                    <span>响应时间: {sample.responseTime}ms</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {report && (
          <div className="detail-section full-width">
            <div className="section-title">📋 完整健康报告</div>
            <div style={{ background: '#1e293b', padding: 20, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
              {JSON.stringify(report, null, 2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ServiceDetail;
