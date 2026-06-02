import { useState, useEffect } from 'react';
import { statisticsApi } from '../api';
import type { Statistics } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  async function loadStatistics() {
    try {
      const response = await statisticsApi.get();
      setStats(response.data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>数据看板</h2>
        <p>城市树木修剪排程 - 概览总览</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats?.totalLocations || 0}</div>
          <div className="stat-label">📍 点位总数</div>
        </div>
        <div className="stat-card urgent">
          <div className="stat-value">{stats?.totalFeedbacks || 0}</div>
          <div className="stat-label">📝 居民反馈</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{stats?.pendingFeedbacks || 0}</div>
          <div className="stat-label">⏳ 待处理反馈</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.totalPlans || 0}</div>
          <div className="stat-value" style={{ color: 'var(--warning-color)'}}>{stats?.draftPlans || 0}</div>
          <div className="stat-label">📋 修剪方案（草稿）</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats?.totalReports || 0}</div>
          <div className="stat-label">📑 完成报告</div>
        </div>
        <div className="stat-card" style={{ background: '#fef2f2' }}>
          <div className="stat-value" style={{ color: 'var(--danger-color)'}}>{stats?.unresolvedConflicts || 0}</div>
          <div className="stat-label">⚠️ 数据冲突</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>反馈优先级分布</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {stats?.byPriority?.map((item: any) => (
              <div key={item.priority} style={{ 
                flex: '1', 
                minWidth: '150px',
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                  {item.count}
                </div>
                <div className={`badge badge-${item.priority}`}>
                  {item.priority === 'urgent' ? '紧急' : 
                   item.priority === 'high' ? '高' : 
                   item.priority === 'medium' ? '中' : '低'}优先级
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>反馈状态分布</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {stats?.byStatus?.map((item: any) => (
              <div key={item.status} style={{ 
                flex: '1', 
                minWidth: '150px',
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                  {item.count}
                </div>
                <div className={`badge badge-${item.status}`}>
                  {item.status === 'pending' ? '待处理' : 
                   item.status === 'processing' ? '处理中' : 
                   item.status === 'resolved' ? '已解决' : '已关闭'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
