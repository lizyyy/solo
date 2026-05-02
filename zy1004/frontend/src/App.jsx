import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, theme } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  CalendarOutlined,
  ToolOutlined,
  DatabaseOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import NewOrder from './pages/NewOrder';
import Schedule from './pages/Schedule';
import SpareParts from './pages/SpareParts';
import Backup from './pages/Backup';

const { Header, Sider, Content } = Layout;

function MenuLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '经营概览',
      onClick: () => navigate('/'),
    },
    {
      key: '/orders',
      icon: <FileTextOutlined />,
      label: '维修单管理',
      onClick: () => navigate('/orders'),
    },
    {
      key: '/schedule',
      icon: <CalendarOutlined />,
      label: '技师排期',
      onClick: () => navigate('/schedule'),
    },
    {
      key: '/spare-parts',
      icon: <ToolOutlined />,
      label: '备件管理',
      onClick: () => navigate('/spare-parts'),
    },
    {
      key: '/backup',
      icon: <DatabaseOutlined />,
      label: '数据备份',
      onClick: () => navigate('/backup'),
    },
  ];

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return '/';
    if (path.startsWith('/orders/')) return '/orders';
    if (path === '/orders/new') return '/orders';
    return menuItems.find(item => path.startsWith(item.key))?.key || '/';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
          {collapsed ? '修' : '维修工作台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>家电维修店接单排期工作台</h2>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/orders/new')}
          >
            新建维修单
          </Button>
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
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MenuLayout><Dashboard /></MenuLayout>} />
        <Route path="/orders" element={<MenuLayout><Orders /></MenuLayout>} />
        <Route path="/orders/new" element={<MenuLayout><NewOrder /></MenuLayout>} />
        <Route path="/orders/:id" element={<MenuLayout><OrderDetail /></MenuLayout>} />
        <Route path="/schedule" element={<MenuLayout><Schedule /></MenuLayout>} />
        <Route path="/spare-parts" element={<MenuLayout><SpareParts /></MenuLayout>} />
        <Route path="/backup" element={<MenuLayout><Backup /></MenuLayout>} />
      </Routes>
    </Router>
  );
}

export default App;
