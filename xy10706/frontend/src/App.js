import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  BarChartOutlined,
  UserOutlined,
  GiftOutlined,
  ApiOutlined,
  HistoryOutlined,
  FileTextOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Statistics from './pages/Statistics';
import Customers from './pages/Customers';
import Packages from './pages/Packages';
import Endpoints from './pages/Endpoints';
import CallRecords from './pages/CallRecords';
import Billing from './pages/Billing';
import Reviews from './pages/Reviews';

const { Header, Content, Sider } = Layout;

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/statistics', icon: <BarChartOutlined />, label: '统计分析' },
    { key: '/customers', icon: <UserOutlined />, label: '客户管理' },
    { key: '/packages', icon: <GiftOutlined />, label: '套餐管理' },
    { key: '/endpoints', icon: <ApiOutlined />, label: '接口管理' },
    { key: '/calls', icon: <HistoryOutlined />, label: '调用记录' },
    { key: '/reviews', icon: <CheckCircleOutlined />, label: '复核管理' },
    { key: '/billing', icon: <FileTextOutlined />, label: '计费明细' },
  ];

  return (
    <Layout>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 16 : 20,
          fontWeight: 'bold',
          background: 'rgba(255,255,255,0.1)'
        }}>
          {collapsed ? '配额' : '配额账本系统'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: 0,
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 24
        }}>
          <h2 style={{ margin: 0 }}>接口限流配额账本管理系统</h2>
        </Header>
        <Content style={{
          margin: '24px 16px',
          padding: 24,
          minHeight: 280,
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
        }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/packages" element={<Packages />} />
            <Route path="/endpoints" element={<Endpoints />} />
            <Route path="/calls" element={<CallRecords />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/billing" element={<Billing />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
