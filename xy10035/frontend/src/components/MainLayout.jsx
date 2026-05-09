import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  SearchOutlined,
  BranchesOutlined,
  FileTextOutlined,
  SettingOutlined
} from '@ant-design/icons';

const { Header, Sider } = Layout;

const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/logs',
      icon: <SearchOutlined />,
      label: '日志搜索',
    },
    {
      key: '/traces',
      icon: <BranchesOutlined />,
      label: '追踪回放',
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: '报告管理',
      children: [
        { key: '/reports', label: '报告列表' },
        { key: '/reports/generate', label: '生成报告' }
      ]
    }
  ];

  const getSelectedKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/reports')) {
      return ['/reports'];
    }
    if (path.startsWith('/traces/')) {
      return ['/traces'];
    }
    return [path];
  };

  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/reports')) {
      return ['/reports'];
    }
    return [];
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold'
        }}>
          <BranchesOutlined style={{ marginRight: 8 }} />
          日志分析系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          background: '#fff', 
          padding: '0 24px', 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)'
        }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {location.pathname === '/dashboard' && '系统仪表盘'}
            {location.pathname === '/logs' && '日志搜索'}
            {location.pathname === '/traces' && '追踪列表'}
            {location.pathname.startsWith('/traces/') && '追踪回放'}
            {location.pathname === '/reports' && '报告列表'}
            {location.pathname === '/reports/generate' && '生成报告'}
          </div>
        </Header>
        {children}
      </Layout>
    </Layout>
  );
};

export default MainLayout;
