import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  CalendarOutlined,
  TeamOutlined,
  ImportOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { getUserRoleLabel } from '../utils/constants';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '仪表盘'
  },
  {
    key: '/activities',
    icon: <CalendarOutlined />,
    label: '活动管理'
  },
  {
    key: '/registrations',
    icon: <TeamOutlined />,
    label: '报名管理'
  },
  {
    key: '/import-export',
    icon: <ImportOutlined />,
    label: '导入导出'
  },
  {
    key: '/analytics',
    icon: <BarChartOutlined />,
    label: '数据分析'
  }
];

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userDropdownItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: `${user?.name} (${getUserRoleLabel(user?.role)})`
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 16,
            fontWeight: 'bold',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Title level={5} style={{ color: '#fff', margin: 0 }}>
            报名管理系统
          </Title>
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
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <Space>
            <Dropdown menu={{ items: userDropdownItems }}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.name}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
