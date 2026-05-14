import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  FileSearchOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Environments from './pages/Environments';
import Datasets from './pages/Datasets';
import Cleanup from './pages/Cleanup';

const { Header, Sider, Content } = Layout;

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '数据看板',
    },
    {
      key: '/tasks',
      icon: <FileSearchOutlined />,
      label: '任务管理',
    },
    {
      key: '/environments',
      icon: <CloudServerOutlined />,
      label: '环境管理',
    },
    {
      key: '/datasets',
      icon: <DatabaseOutlined />,
      label: '数据集版本',
    },
    {
      key: '/cleanup',
      icon: <DeleteOutlined />,
      label: '清理策略',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 4 }} />
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{ padding: '0 24px', fontSize: 18, fontWeight: 600 }}>
            种子数据管理系统
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: 8,
            overflow: 'auto',
          }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/environments" element={<Environments />} />
            <Route path="/datasets" element={<Datasets />} />
            <Route path="/cleanup" element={<Cleanup />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
