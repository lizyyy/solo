import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Avatar, Badge, Dropdown, Button } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  CheckCircleOutlined,
  AlertOutlined,
  LogoutOutlined,
  BellOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Medicines from './pages/Medicines';
import FollowupTasks from './pages/FollowupTasks';
import Alerts from './pages/Alerts';
import { useStore } from './store';

const { Header, Sider, Content } = Layout;

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { currentUser, getUnhandledAlerts } = useStore();
  const unhandledAlerts = getUnhandledAlerts();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/members', icon: <UserOutlined />, label: '会员管理' },
    { key: '/medicines', icon: <MedicineBoxOutlined />, label: '药品管理' },
    { key: '/tasks', icon: <CheckCircleOutlined />, label: '回访任务' },
    { key: '/alerts', icon: <AlertOutlined />, label: '异常提醒' },
  ];

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        width={220}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {!collapsed && <h3 style={{ margin: 0, color: '#1890ff' }}>慢病回访台</h3>}
          {collapsed && <h3 style={{ margin: 0, color: '#1890ff' }}>回访</h3>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 16,
          }}
        >
          <Badge count={unhandledAlerts.length} size="small">
            <Button
              type="text"
              icon={<BellOutlined style={{ fontSize: 18 }} />}
              onClick={() => navigate('/alerts')}
            />
          </Badge>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span>{currentUser.name}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px', background: '#fff', borderRadius: 8 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/members" element={<Members />} />
            <Route path="/medicines" element={<Medicines />} />
            <Route path="/tasks" element={<FollowupTasks />} />
            <Route path="/alerts" element={<Alerts />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
