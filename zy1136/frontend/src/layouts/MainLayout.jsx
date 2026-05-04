import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme, message, Spin } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { menuItems } from '../utils/constants';
import { dashboardAPI } from '../services/api';

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getOverview();
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const selectedKey = location.pathname === '/' ? '/dashboard' : location.pathname;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={(value) => setCollapsed(value)}
        theme="dark"
      >
        <div
          style={{
            height: 64,
            margin: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: collapsed ? 16 : 20,
            fontWeight: 'bold',
          }}
        >
          {collapsed ? 'NM' : '网络管理台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
            {menuItems.find(item => item.key === selectedKey)?.label || '仪表盘'}
          </div>
          {stats && (
            <div style={{ display: 'flex', gap: 20 }}>
              <span style={{ color: '#ff4d4f' }}>
                告警: {stats.alerts?.unacknowledged || 0}
              </span>
              <span style={{ color: '#fa8c16' }}>
                风险: {stats.risks?.highRiskCount || 0}
              </span>
              <span style={{ color: '#1890ff' }}>
                变更: {stats.changes?.pending || 0}
              </span>
            </div>
          )}
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet context={{ refreshStats: fetchStats }} />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
