import React, { useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, Button, Spin, message } from 'antd';
import {
  ShoppingCartOutlined,
  UserOutlined,
  UnorderedListOutlined,
  WarningOutlined,
  FileTextOutlined,
  DashboardOutlined,
  LogoutOutlined
} from '@ant-design/icons';

import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import OrderListPage from './pages/OrderListPage';
import OrderDetailModal from './components/OrderDetailModal';
import UserManagementPage from './pages/UserManagementPage';
import AuditLogPage from './pages/AuditLogPage';
import FailedOpsPage from './pages/FailedOpsPage';

type MenuKey = 'orders' | 'users' | 'logs' | 'failed';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const [currentMenu, setCurrentMenu] = useState<MenuKey>('orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const roleLabels: Record<string, string> = {
    admin: '管理员',
    customer_service: '客服',
    normal: '普通用户'
  };

  const handleLogout = async () => {
    await logout();
    message.success('已退出登录');
  };

  const userDropdown = (
    <Menu>
      <Menu.Item key="logout" onClick={handleLogout} icon={<LogoutOutlined />}>
        退出登录
      </Menu.Item>
    </Menu>
  );

  const menuItems = [
    {
      key: 'orders',
      icon: <ShoppingCartOutlined />,
      label: '补发工单'
    }
  ];

  if (user.role === 'admin' || user.role === 'customer_service') {
    menuItems.push({
      key: 'failed',
      icon: <WarningOutlined />,
      label: '异常处理'
    });
  }

  if (user.role === 'admin' || user.role === 'customer_service') {
    menuItems.push({
      key: 'logs',
      icon: <FileTextOutlined />,
      label: '操作日志'
    });
  }

  if (user.role === 'admin') {
    menuItems.push({
      key: 'users',
      icon: <UserOutlined />,
      label: '用户管理'
    });
  }

  const renderContent = () => {
    switch (currentMenu) {
      case 'orders':
        return (
          <OrderListPage
          currentUser={user}
          onViewDetail={setSelectedOrderId}
        />
        );
      case 'users':
        return <UserManagementPage currentUser={user} />;
      case 'logs':
        return <AuditLogPage />;
      case 'failed':
        return <FailedOpsPage currentUser={user} />;
      default:
        return null;
    }
  };

  return (
    <Layout className="layout">
      <Header className="layout-header">
        <div className="title">
          <DashboardOutlined style={{ marginRight: 12 }} />
          补发工单管理系统
        </div>
        <div className="user-info">
          <span>{user.name}</span>
          <span style={{ color: '#999' }}>({roleLabels[user.role]})</span>
          <Dropdown overlay={userDropdown}>
            <Button type="text" style={{ color: 'white', height: 32 }}>
              <Avatar icon={<UserOutlined />} />
            </Button>
          </Dropdown>
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[currentMenu]}
            onClick={({ key }) => setCurrentMenu(key as MenuKey)}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Content className="layout-content">
          {renderContent()}
        </Content>
      </Layout>
      <OrderDetailModal
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        currentUser={user}
      />
    </Layout>
  );
};

export default App;
