import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BatchImportModal from '../components/BatchImportModal';

function ServiceList() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    owner: '',
    search: ''
  });
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/services?${params}`);
      const data = await response.json();
      setServices(data);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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

  const getScoreColor = (score) => {
    if (score >= 80) return '#22c55e';
    if (score >= 50) return '#eab308';
    return '#ef4444';
  };

  const formatTime = (time) => {
    if (!time) return '从未检查';
    return new Date(time).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <span>加载中...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="filters">
        <div className="filter-group">
          <label>状态筛选</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="healthy">健康</option>
            <option value="degraded">降级</option>
            <option value="unhealthy">异常</option>
            <option value="recovering">恢复中</option>
          </select>
        </div>
        <div className="filter-group">
          <label>负责人</label>
          <select
            value={filters.owner}
            onChange={(e) => handleFilterChange('owner', e.target.value)}
          >
            <option value="">全部团队</option>
            {[...new Set(services.map(s => s.owner))].map(owner => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>搜索</label>
          <input
            type="text"
            placeholder="搜索服务名称或描述"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>
        <div className="btn-group">
          <button
            className="btn btn-secondary"
            onClick={() => setShowImportModal(true)}
          >
            📥 批量导入
          </button>
          <button
            className="btn btn-primary"
            onClick={fetchServices}
          >
            🔄 刷新
          </button>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <p>暂无服务数据，请批量导入或添加服务</p>
        </div>
      ) : (
        <div className="services-grid">
          {services.map(service => (
            <div
              key={service.id}
              className="service-card"
              onClick={() => navigate(`/service/${service.id}`)}
            >
              <div className="service-header">
                <div>
                  <div className="service-name">{service.name}</div>
                  <div className="service-owner">👤 {service.owner}</div>
                </div>
                <span className={`status-badge ${getStatusColor(service.status)}`}>
                  {getStatusText(service.status)}
                </span>
              </div>

              <div className="health-score">
                <div className="score-bar">
                  <div
                    className="score-fill"
                    style={{
                      width: `${service.healthScore}%`,
                      background: getScoreColor(service.healthScore)
                    }}
                  />
                </div>
                <span className="score-text" style={{ color: getScoreColor(service.healthScore) }}>
                  {service.healthScore}
                </span>
              </div>

              <p className="service-description">{service.description}</p>

              <div className="tags">
                {service.tags.map((tag, idx) => (
                  <span key={idx} className="tag">{tag}</span>
                ))}
              </div>

              <div className="service-meta">
                <span>上次检查: {formatTime(service.lastCheckAt)}</span>
                <span>点击查看详情 →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showImportModal && (
        <BatchImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={fetchServices}
        />
      )}
    </div>
  );
}

export default ServiceList;
