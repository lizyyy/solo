import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RenewalBatch, DeviceGroup } from '../types';

interface BatchListProps {
  batches: RenewalBatch[];
  onCreateBatch: () => void;
  onRefresh: () => void;
  activeFilters?: {
    groups: string[];
    expiryDays: number | null;
  };
}

const groupNames: Record<string, string> = {
  'factory-a': 'A厂区',
  'factory-b': 'B厂区',
  'warehouse': '仓库',
  'retail': '零售门店',
  'logistics': '物流'
};

const BatchList: React.FC<BatchListProps> = ({ batches, onCreateBatch, onRefresh, activeFilters }) => {
  const navigate = useNavigate();

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      created: '已创建',
      processing: '处理中',
      completed: '已完成',
      partial: '部分完成'
    };
    return labels[status] || status;
  };

  const getBatchStats = (batch: RenewalBatch) => {
    const stats = {
      total: batch.records.length,
      success: 0,
      failed: 0,
      pending: 0,
      compensating: 0
    };
    batch.records.forEach(r => {
      if (r.status === 'success' || r.status === 'compensated' || r.status === 'revoked') stats.success++;
      else if (r.status === 'failed' || r.status === 'revoke_failed') stats.failed++;
      else if (r.status === 'compensating') stats.compensating++;
      else stats.pending++;
    });
    return stats;
  };

  const hasActiveFilters = activeFilters && (activeFilters.groups.length > 0 || activeFilters.expiryDays !== null);

  return (
    <div>
      <div className="header">
        <div>
          <h1>续期批次列表</h1>
          {hasActiveFilters && (
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {activeFilters!.groups.map(g => (
                <span key={g} className="status-badge status-processing">
                  📁 {groupNames[g] || g}
                </span>
              ))}
              {activeFilters!.expiryDays !== null && (
                <span className="status-badge status-processing">
                  ⏰ {activeFilters!.expiryDays}天内到期
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={onRefresh}>
            🔄 刷新
          </button>
          <button className="btn btn-success" onClick={onCreateBatch}>
            + 新建批次
          </button>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="empty-state">
          <h3>暂无续期批次</h3>
          <p>点击"新建批次"创建第一个证书续期任务</p>
        </div>
      ) : (
        <div className="batch-list">
          {batches.map(batch => {
            const stats = getBatchStats(batch);
            return (
              <div
                key={batch.id}
                className="batch-card"
                onClick={() => navigate(`/batch/${batch.id}`)}
              >
                <div className="batch-header">
                  <div>
                    <div className="batch-title">{batch.name}</div>
                    <div className="batch-meta">
                      创建人: {batch.createdBy} | 创建时间: {new Date(batch.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <span className={`status-badge status-${batch.status}`}>
                    {getStatusLabel(batch.status)}
                  </span>
                </div>
                
                <div className="batch-stats">
                  <div className="stat-item">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">总设备数</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value" style={{ color: '#10b981' }}>{stats.success}</div>
                    <div className="stat-label">续期成功</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value" style={{ color: '#ef4444' }}>{stats.failed}</div>
                    <div className="stat-label">续期失败</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.pending}</div>
                    <div className="stat-label">待处理</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.compensating}</div>
                    <div className="stat-label">待补偿</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BatchList;