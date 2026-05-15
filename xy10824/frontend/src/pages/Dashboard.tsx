import React, { useState, useEffect } from 'react';
import { adminApi } from '../api/client';
import type { Statistics } from '../api/client';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await adminApi.getStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!stats) {
    return <div className="error-message">加载统计数据失败</div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>系统总览</h2>
      
      <div className="dashboard">
        <div className="card">
          <h3>预占单总数</h3>
          <div className="value">{stats.totalReservations}</div>
        </div>

        <div className="card">
          <h3>待确认</h3>
          <div className="value status-RESERVED">{stats.statusStats.RESERVED || 0}</div>
        </div>

        <div className="card">
          <h3>已确认</h3>
          <div className="value status-CONFIRMED">{stats.statusStats.CONFIRMED || 0}</div>
        </div>

        <div className="card">
          <h3>已释放</h3>
          <div className="value status-RELEASED">{stats.statusStats.RELEASED || 0}</div>
        </div>

        <div className={`card ${stats.failedTasks > 0 ? 'warning' : ''}`}>
          <h3>释放失败</h3>
          <div className="value">{stats.failedTasks}</div>
        </div>

        <div className="card inventory-card">
          <h3>库存池状态</h3>
          <div className="inventory-list">
            {stats.inventoryStats.map((pool) => (
              <div key={pool.pool_id} className="inventory-item">
                <h4>{pool.pool_name}</h4>
                <div className="inventory-stats">
                  <span>📦 总量: {pool.total_quantity}</span>
                  <span>🔒 预占: {pool.reserved_quantity}</span>
                  <span>✅ 可用: {pool.available_quantity}</span>
                </div>
              </div>
            ))}
            {stats.inventoryStats.length === 0 && (
              <p style={{ color: '#666', fontStyle: 'italic' }}>暂无库存池</p>
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <h2>快捷操作</h2>
        <div className="btn-group">
          <button
            className="btn btn-warning"
            onClick={async () => {
              try {
                const res = await adminApi.processTimeouts();
                alert(`成功处理 ${res.data.processed} 个超时任务`);
                fetchStats();
              } catch (error) {
                alert('处理超时任务失败');
              }
            }}
          >
            处理超时任务
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;