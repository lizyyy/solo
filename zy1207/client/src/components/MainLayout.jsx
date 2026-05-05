import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: '仪表盘',
  },
  {
    key: '/interfaces',
    icon: <FileTextOutlined />,
    label: '接口清单',
  },
  {
    key: '/traffic-models',
    icon: <ThunderboltOutlined />,
    label: '流量模型',
  },
  {
    key: '/test-batches',
    icon: <HistoryOutlined />,
    label: '压测批次',
  },
  {
    key: '/analysis',
    icon: <BarChartOutlined />,
    label: '对比分析',
  },
  {
    key: '/tasks',
    icon: <CheckCircleOutlined />,
    label: '调优任务',
  },
];

function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        theme="light"
        width={220}
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: collapsed ? 12 : 18,
          fontWeight: 'bold',
          color: '#1890ff',
        }}>
          {collapsed ? '压测' : '压测复盘看板'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            {menuItems.find(item => item.key === location.pathname)?.label || '压测复盘看板'}
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;
