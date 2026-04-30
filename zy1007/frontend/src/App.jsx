import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, message } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  ToolOutlined,
  PlusOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import WorkOrderList from './pages/WorkOrderList';
import WorkOrderDetail from './pages/WorkOrderDetail';
import SpareParts from './pages/SpareParts';
import CreateWorkOrder from './pages/CreateWorkOrder';
import { healthApi } from './api';

const { Header, Content, Sider } = Layout;

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [healthStatus, setHealthStatus] = useState(false);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      await healthApi.check();
      setHealthStatus(true);
    } catch (error) {
      console.error('后端服务未启动:', error);
      message.warning('后端服务未启动，请先启动后端服务');
    }
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '今日看板'
    },
    {
      key: '/work-orders',
      icon: <FileTextOutlined />,
      label: '工单列表'
    },
    {
      key: '/spare-parts',
      icon: <ToolOutlined />,
      label: '备件管理'
    }
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const getSelectedKeys = () => {
    if (location.pathname === '/') return ['/'];
    if (location.pathname.startsWith('/work-orders')) return ['/work-orders'];
    if (location.pathname === '/spare-parts') return ['/spare-parts'];
    return [];
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 64, margin: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!collapsed && (
            <span style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>维修管理系统</span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>维修工作室管理系统</h2>
          {!healthStatus && (
            <span style={{ color: '#ff4d4f' }}>
              ⚠️ 后端服务未连接
            </span>
          )}
        </Header>
        <Content style={{ margin: '24px', background: '#fff', borderRadius: 8, padding: 24 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/work-orders" element={<WorkOrderList />} />
            <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
            <Route path="/work-orders/create" element={<CreateWorkOrder />} />
            <Route path="/spare-parts" element={<SpareParts />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
