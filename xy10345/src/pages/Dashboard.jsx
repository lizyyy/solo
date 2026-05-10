import React, { useState, useEffect } from 'react';
import { propertyApi, passwordApi, anomalyApi, orderApi } from '../services/api';

function Dashboard() {
  const [stats, setStats] = useState({
    properties: 0,
    activePasswords: 0,
    pendingPasswords: 0,
    expiredPasswords: 0,
    activeOrders: 0,
    pendingAnomalies: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [propertiesRes, passwordsRes, anomaliesRes, ordersRes] = await Promise.all([
        propertyApi.getAll(),
        passwordApi.getAll(),
        anomalyApi.getAll({ resolved: 'false' }),
        orderApi.getAll()
      ]);

      const passwords = passwordsRes.data;
      const activePasswords = passwords.filter(p => p.validation?.status === 'active').length;
      const pendingPasswords = passwords.filter(p => p.validation?.status === 'pending').length;
      const expiredPasswords = passwords.filter(p => p.validation?.status === 'expired' || p.status === 'revoked').length;
      const activeOrders = ordersRes.data.filter(o => o.status === 'active' || o.status === 'upcoming').length;

      setStats({
        properties: propertiesRes.data.length,
        activePasswords,
        pendingPasswords,
        expiredPasswords,
        activeOrders,
        pendingAnomalies: anomaliesRes.data.length
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>📊 系统总览</h2>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>{stats.properties}</h3>
          <p>管理房源</p>
        </div>
        <div className="stat-card">
          <h3>{stats.activeOrders}</h3>
          <p>活跃订单</p>
        </div>
        <div className="stat-card">
          <h3>{stats.activePasswords}</h3>
          <p>生效中密码</p>
        </div>
        <div className="stat-card">
          <h3>{stats.pendingPasswords}</h3>
          <p>待生效密码</p>
        </div>
        <div className="stat-card">
          <h3>{stats.expiredPasswords}</h3>
          <p>已过期/作废</p>
        </div>
        <div className="stat-card" style={{ backgroundColor: stats.pendingAnomalies > 0 ? '#fff3e0' : 'white' }}>
          <h3 style={{ color: stats.pendingAnomalies > 0 ? '#f57c00' : '#1e3a5f' }}>{stats.pendingAnomalies}</h3>
          <p>待处理异常</p>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">📋 系统功能说明</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div className="explanation-box">
            <h4>🔑 密码类型</h4>
            <ul>
              <li><strong>客人入住密码</strong>：根据订单入住退房时间自动生成和失效</li>
              <li><strong>保洁密码</strong>：长期有效，供保洁人员使用</li>
              <li><strong>维修临时密码</strong>：仅限维修期间使用</li>
            </ul>
          </div>
          <div className="explanation-box">
            <h4>🛡️ 安全机制</h4>
            <ul>
              <li>密码时间重叠自动拦截</li>
              <li>退房后密码自动失效</li>
              <li>维修密码越权访问拦截</li>
              <li>过期密码尝试访问记录</li>
            </ul>
          </div>
          <div className="explanation-box">
            <h4>📝 使用流程</h4>
            <ul>
              <li>在日历页面选择日期创建订单</li>
              <li>系统自动生成对应入住密码</li>
              <li>可手动延期或作废密码</li>
              <li>查看审计报告了解密码状态</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
