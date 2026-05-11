import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Button, Space } from 'antd';
import {
  DashboardOutlined,
  InventoryOutlined,
  SwapOutlined,
  HistoryOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import authService from '../services/authService';

const { Header, Sider, Content } = Layout;

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getCurrentUser();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘'
    },
    {
      key: '/inventory',
      icon: <InventoryOutlined />,
      label: '库存管理'
    },
    {
      key: '/transfer',
      icon: <SwapOutlined />,
      label: '库存调拨'
    },
    {
      key: '/operations',
      icon: <HistoryOutlined />,
      label: '操作日志'
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: '报表导出'
    }
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const userMenu = {
    items: [
      {
        key: '1',
        label: (
          <div>
            <div style={{ fontWeight: 'bold' }}>{user?.name}</div>
            <div style={{ fontSize: '12px', color: '#888' }}>{user?.role}</div>
          </div>
        ),
        disabled: true
      },
      { type: 'divider' },
      {
        key: '2',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout
      }
    ]
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div style={{ height: 64, margin: 16, color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center', lineHeight: '32px' }}>
          {collapsed ? 'IMS' : '库存管理系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: '#fff' }}>
          <Space style={{ float: 'left', marginLeft: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '16px', width: 64, height: 64 }}
            />
          </Space>
          <Space style={{ float: 'right', marginRight: 16 }}>
            <Dropdown menu={userMenu}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.name}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: '#fff' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default AppLayout;
