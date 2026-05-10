import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { keyApi, orderApi } from '../services/api';
import moment from 'moment';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalKeys: 0,
    availableKeys: 0,
    inUseKeys: 0,
    overdueKeys: 0,
    totalOrders: 0,
    pendingOrders: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [keysRes, ordersRes, overdueRes] = await Promise.all([
        keyApi.getAll(),
        orderApi.getAll(),
        keyApi.getOverdue(),
      ]);
      
      const keys = keysRes.data;
      const orders = ordersRes.data;
      
      setStats({
        totalKeys: keys.length,
        availableKeys: keys.filter(k => k.status === 'available').length,
        inUseKeys: keys.filter(k => k.status === 'in_use').length,
        overdueKeys: overdueRes.data.length,
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
      });
      
      const todayOrders = orders.filter(o => 
        moment(o.scheduledDate).isSame(moment(), 'day')
      );
      setRecentActivity(todayOrders.slice(0, 5));
      
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status) => {
    const map = {
      available: '可用',
      in_use: '使用中',
      overdue: '逾期',
      maintenance: '维护中',
    };
    return map[status] || status;
  };

  const getStatusBadge = (status) => {
    const map = {
      available: 'badge-success',
      in_use: 'badge-warning',
      overdue: 'badge-danger',
      maintenance: 'badge-primary',
    };
    return map[status] || 'badge-primary';
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">系统概览</h2>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalKeys}</div>
            <div className="stat-label">钥匙总数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#27ae60' }}>{stats.availableKeys}</div>
            <div className="stat-label">可用钥匙</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#f39c12' }}>{stats.inUseKeys}</div>
            <div className="stat-label">使用中</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#e74c3c' }}>{stats.overdueKeys}</div>
            <div className="stat-label">逾期未还</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#17a2b8' }}>{stats.totalOrders}</div>
            <div className="stat-label">订单总数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#9b59b6' }}>{stats.pendingOrders}</div>
            <div className="stat-label">待处理订单</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">今日订单</h2>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/orders')}>
            查看全部
          </button>
        </div>
        
        {recentActivity.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>客户</th>
                <th>服务类型</th>
                <th>保洁员</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map(order => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.customerName}</td>
                  <td>{order.serviceType}</td>
                  <td>{order.cleanerName}</td>
                  <td>
                    <span className={`badge ${getStatusBadge(order.status === 'pending' ? 'in_use' : order.status)}`}>
                      {getStatusText(order.status === 'pending' ? 'in_use' : order.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-muted">今日暂无订单</p>
        )}
      </div>

      {stats.overdueKeys > 0 && (
        <div className="alert alert-danger">
          <strong>⚠️ 逾期提醒：</strong>当前有 {stats.overdueKeys} 把钥匙逾期未还，请及时处理！
        </div>
      )}
    </div>
  );
};

export default Dashboard;
