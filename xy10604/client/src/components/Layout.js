import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Button, Avatar, Dropdown, theme } from 'antd';
import {
  DashboardOutlined,
  ExperimentOutlined,
  BlockOutlined,
  SafetyCertificateOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  DownloadOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const { Header, Sider, Content } = AntLayout;

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: '仪表盘',
  },
  {
    key: '/batches',
    icon: <ExperimentOutlined />,
    label: '试剂批号',
  },
  {
    key: '/experiments',
    icon: <SafetyCertificateOutlined />,
    label: '实验预约',
  },
  {
    key: '/blocks',
    icon: <BlockOutlined />,
    label: '拦截记录',
  },
  {
    key: '/reviews',
    icon: <SafetyCertificateOutlined />,
    label: '复核记录',
  },
  {
    key: '/discards',
    icon: <DeleteOutlined />,
    label: '废弃记录',
  },
  {
    key: '/audit',
    icon: <FileSearchOutlined />,
    label: '操作日志',
  },
  {
    key: '/exports',
    icon: <DownloadOutlined />,
    label: '导出报告',
  },
];

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const userMenuItems = [
    {
      key: '1',
      label: `${user?.name} (${user?.role})`,
      disabled: true,
      icon: <UserOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: '2',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  const getSelectedKey = () => {
    if (location.pathname.startsWith('/batches/')) return '/batches';
    if (location.pathname.startsWith('/experiments/')) return '/experiments';
    return location.pathname;
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
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
            fontSize: collapsed ? 12 : 18,
            fontWeight: 'bold',
          }}
        >
          {collapsed ? '试剂' : '试剂效期管理'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ margin: 0 }}>实验试剂开封效期管理系统</h2>
          <Dropdown menu={{ items: userMenuItems }}>
            <Button type="text">
              <Avatar size="small" icon={<UserOutlined />} />
              <span style={{ marginLeft: 8 }}>{user?.name}</span>
            </Button>
          </Dropdown>
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
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
