import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Button, Spin, message } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  ShareAltOutlined,
  FileTextOutlined,
  WarningOutlined,
  LogoutOutlined,
  UserOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import SharedServices from './pages/SharedServices';
import BillImport from './pages/BillImport';
import BillRecords from './pages/BillRecords';
import Anomalies from './pages/Anomalies';
import { ROLE_LABELS } from './utils/constants';

const { Header, Sider, Content } = Layout;

function PrivateRoute({ children, user, requiredRoles }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    message.error('您没有权限访问此页面');
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !user && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [user, loading, location.pathname, navigate]);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '看板概览',
    },
    {
      key: '/projects',
      icon: <ProjectOutlined />,
      label: '项目管理',
    },
    {
      key: '/shared-services',
      icon: <ShareAltOutlined />,
      label: '共享服务分摊',
    },
    {
      key: '/bill-import',
      icon: <FileTextOutlined />,
      label: '账单导入',
    },
    {
      key: '/bill-records',
      icon: <CloudServerOutlined />,
      label: '账单明细',
    },
    {
      key: '/anomalies',
      icon: <WarningOutlined />,
      label: '异常处理',
    },
  ];

  const userMenu = {
    items: [
      {
        key: '1',
        label: (
          <div style={{ padding: '8px 0' }}>
            <div style={{ fontWeight: 600 }}>{user?.fullName}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {ROLE_LABELS[user?.role]}
            </div>
          </div>
        ),
        disabled: true,
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout className="app-layout" style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: '#001529' }}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: collapsed ? 16 : 18, fontWeight: 600 }}>
          {collapsed ? '云' : '云资源预算归属台'}
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
        <Header className="app-header" style={{ background: '#001529', padding: '0 24px' }}>
          <div style={{ color: 'white', fontSize: 16, fontWeight: 500 }}>
            {menuItems.find(item => item.key === location.pathname)?.label || '云资源预算归属台'}
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Button type="text" style={{ color: 'white', height: '100%', padding: '0 16px' }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <span style={{ marginLeft: 8 }}>{user.fullName}</span>
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px', padding: 24, background: '#f0f2f5', minHeight: 280 }}>
          <Routes>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={
              <PrivateRoute user={user}>
                <Dashboard user={user} />
              </PrivateRoute>
            } />
            <Route path="/projects" element={
              <PrivateRoute user={user}>
                <Projects user={user} />
              </PrivateRoute>
            } />
            <Route path="/shared-services" element={
              <PrivateRoute user={user}>
                <SharedServices user={user} />
              </PrivateRoute>
            } />
            <Route path="/bill-import" element={
              <PrivateRoute user={user}>
                <BillImport user={user} />
              </PrivateRoute>
            } />
            <Route path="/bill-records" element={
              <PrivateRoute user={user}>
                <BillRecords user={user} />
              </PrivateRoute>
            } />
            <Route path="/anomalies" element={
              <PrivateRoute user={user}>
                <Anomalies user={user} />
              </PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
