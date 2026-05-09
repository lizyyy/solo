import React from 'react';
import { Layout, Menu, Dropdown, Avatar, Button, Badge } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  LogoutOutlined,
  UserOutlined,
  BellOutlined
} from '@ant-design/icons';
import { logout } from '../services/api';
import { message } from 'antd';

const { Header, Sider, Content } = Layout;

function AppLayout({ user, onLogout, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      message.success('已登出');
      onLogout();
      navigate('/');
    } catch (error) {
      message.error('登出失败');
    }
  };

  const userMenu = {
    items: [
      {
        key: '1',
        label: (
          <div>
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{user.department}</div>
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

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘'
    },
    {
      key: '/candidates',
      icon: <TeamOutlined />,
      label: '候选人管理'
    },
    {
      key: '/offers',
      icon: <FileTextOutlined />,
      label: 'Offer 管理'
    },
    {
      key: '/my-approvals',
      icon: <CheckCircleOutlined />,
      label: '我的审批'
    }
  ];

  if (user.role === 'hr_admin' || user.role === 'director') {
    menuItems.push({
      key: '/audit-logs',
      icon: <HistoryOutlined />,
      label: '审计日志'
    });
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} style={{ background: '#001529' }}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 600,
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          Offer 审批台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)'
        }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#333' }}>
            {menuItems.find(m => m.key === location.pathname)?.label || 'Offer 变更审批系统'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={0}>
              <Button type="text" icon={<BellOutlined />} />
            </Badge>
            <Dropdown menu={userMenu} placement="bottomRight">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                padding: '4px 12px',
                borderRadius: 4
              }}>
                <Avatar icon={<UserOutlined />} size="small" style={{ marginRight: 8 }} />
                <span style={{ color: '#333' }}>{user.name}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ background: '#f0f2f5', minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

export default AppLayout;
