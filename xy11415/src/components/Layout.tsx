import React from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Button } from 'antd';
import {
  HomeOutlined,
  FileTextOutlined,
  AuditOutlined,
  MoneyCollectOutlined,
  BarChartOutlined,
  HistoryOutlined,
  LogoutOutlined,
  UserOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { RoleLabel, rolePermissions, Role } from '../../shared/types.js';

const { Header, Sider, Content } = AntLayout;

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const getAllMenuItems = () => {
    const items = [
      {
        key: '/dashboard',
        icon: <HomeOutlined />,
        label: '仪表盘',
        permission: 'batch:view'
      },
      {
        key: '/batches',
        icon: <FileTextOutlined />,
        label: '批次管理',
        permission: 'batch:list',
        children: [
          {
            key: '/batches',
            label: '批次列表',
            permission: 'batch:list'
          },
          {
            key: '/batches/create',
            icon: <PlusOutlined />,
            label: '创建批次',
            permission: 'batch:create'
          }
        ]
      },
      {
        key: '/review',
        icon: <AuditOutlined />,
        label: '复核工作台',
        permission: 'review:approve'
      },
      {
        key: '/settlement',
        icon: <MoneyCollectOutlined />,
        label: '冻结结算',
        permission: 'settlement:freeze'
      },
      {
        key: '/reports',
        icon: <BarChartOutlined />,
        label: '报表中心',
        permission: 'report:view'
      },
      {
        key: '/audit',
        icon: <HistoryOutlined />,
        label: '审计日志',
        permission: 'audit:view'
      }
    ];

    const userPerms = user ? rolePermissions[user.role as Role] || [] : [];

    const filterItems = (items: any[]): any[] => {
      return items
        .filter(item => !item.permission || userPerms.includes(item.permission))
        .map(item => ({
          ...item,
          children: item.children ? filterItems(item.children) : undefined
        }))
        .filter(item => !item.children || item.children.length > 0);
    };

    return filterItems(items);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: '1',
      label: (
        <div>
          <div>{user?.realName}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {user ? RoleLabel[user.role as Role] : ''}
          </div>
        </div>
      ),
      disabled: true
    },
    {
      type: 'divider' as const
    },
    {
      key: '2',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider width={240} theme="dark" style={{ background: '#1e3a5f' }}>
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#fff',
          fontSize: '18px',
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          维修异常回执系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ background: '#1e3a5f', border: 'none' }}
          items={getAllMenuItems()}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ 
          background: '#fff', 
          padding: '0 24px', 
          display: 'flex', 
          justifyContent: 'flex-end',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <span>{user?.realName}</span>
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px', padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
