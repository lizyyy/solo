import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, ConfigProvider, zhCN } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  CarOutlined,
  UserOutlined,
  CalendarOutlined,
  MoneyCollectOutlined,
  UploadOutlined,
  DownloadOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Plots from './pages/Plots';
import Machines from './pages/Machines';
import Operators from './pages/Operators';
import Reservations from './pages/Reservations';
import Subsidies from './pages/Subsidies';
import ImportData from './pages/ImportData';
import ExportData from './pages/ExportData';
import RiskView from './pages/RiskView';

const { Header, Sider, Content } = Layout;

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">仪表盘</Link>,
    },
    {
      key: '/plots',
      icon: <FileTextOutlined />,
      label: <Link to="/plots">地块管理</Link>,
    },
    {
      key: '/machines',
      icon: <CarOutlined />,
      label: <Link to="/machines">机具管理</Link>,
    },
    {
      key: '/operators',
      icon: <UserOutlined />,
      label: <Link to="/operators">机手管理</Link>,
    },
    {
      key: '/reservations',
      icon: <CalendarOutlined />,
      label: <Link to="/reservations">预约管理</Link>,
    },
    {
      key: '/subsidies',
      icon: <MoneyCollectOutlined />,
      label: <Link to="/subsidies">油料补贴</Link>,
    },
    {
      key: '/risk',
      icon: <AlertOutlined />,
      label: <Link to="/risk">风险视图</Link>,
    },
    {
      key: '/import',
      icon: <UploadOutlined />,
      label: <Link to="/import">数据导入</Link>,
    },
    {
      key: '/export',
      icon: <DownloadOutlined />,
      label: <Link to="/export">数据导出</Link>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div
          style={{
            height: 64,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: collapsed ? 12 : 16,
          }}
        >
          {collapsed ? '农机' : '农机合作社系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div
            style={{
              padding: '0 24px',
              fontSize: 18,
              fontWeight: 'bold',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            农机合作社作业派工管理系统
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
            <Route path="/plots" element={<Plots />} />
            <Route path="/machines" element={<Machines />} />
            <Route path="/operators" element={<Operators />} />
            <Route path="/reservations" element={<Reservations />} />
            <Route path="/subsidies" element={<Subsidies />} />
            <Route path="/risk" element={<RiskView />} />
            <Route path="/import" element={<ImportData />} />
            <Route path="/export" element={<ExportData />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 6,
          },
        }}
      >
        <AppLayout />
      </ConfigProvider>
    </Router>
  );
}

export default App;
