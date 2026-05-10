import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import Tanks from './pages/Tanks';
import Batches from './pages/Batches';
import Alerts from './pages/Alerts';
import DeathLoss from './pages/DeathLoss';
import Logs from './pages/Logs';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/tanks', icon: <DatabaseOutlined />, label: '暂养池管理' },
  { key: '/batches', icon: <ShoppingCartOutlined />, label: '批次管理' },
  { key: '/alerts', icon: <WarningOutlined />, label: '报警管理' },
  { key: '/death-loss', icon: <ExclamationCircleOutlined />, label: '死耗归因' },
  { key: '/logs', icon: <HistoryOutlined />, label: '操作日志' }
];

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: collapsed ? 14 : 18, fontWeight: 'bold' }}>
          {collapsed ? '海鲜' : '水质联动台'}
        </div>
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
          <div style={{ padding: '0 24px', fontSize: 16, fontWeight: 'bold' }}>
            海鲜暂养池水质联动台
          </div>
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
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tanks" element={<Tanks />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/death-loss" element={<DeathLoss />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
