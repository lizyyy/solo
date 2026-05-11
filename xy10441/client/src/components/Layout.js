import React, { useState, useEffect } from 'react';
import { Layout as AntLayout, Menu, Button, Badge, Dropdown, Avatar, Space, Typography } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  DashboardOutlined,
  ProjectOutlined,
  FileSearchOutlined,
  FileDoneOutlined,
  LogoutOutlined,
  UserOutlined,
  BellOutlined
} from '@ant-design/icons';
import api from '../utils/api';

const { Header, Sider, Content } = AntLayout;
const { Title } = Typography;

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);

  useEffect(() => {
    api.get('/proposals/pending-attachments')
      .then(res => setPendingAttachments(res.data))
      .catch(console.error);
  }, []);

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    {
      key: '/projects',
      icon: <ProjectOutlined />,
      label: '项目管理',
    },
    {
      key: '/versions/compare',
      icon: <FileSearchOutlined />,
      label: '版本对比',
    },
    {
      key: '/confirmed-proposals',
      icon: <FileDoneOutlined />,
      label: '有效方案清单',
    },
  ];

  const selectedKey = location.pathname.split('/').slice(0, 3).join('/') || '/dashboard';

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout();
        navigate('/');
      },
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: '#001529' }}
      >
        <div style={{ 
          height: 64, 
          margin: 16, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 8
        }}>
          <FileDoneOutlined style={{ fontSize: 24, color: '#fff' }} />
          {!collapsed && (
            <span style={{ color: '#fff', marginLeft: 8, fontWeight: 'bold' }}>方案版本台</span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ 
          padding: '0 24px', 
          background: '#fff', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)'
        }}>
          <Title level={4} style={{ margin: 0 }}>
            售前方案版本管理平台
          </Title>
          <Space>
            <Badge count={pendingAttachments.length} offset={[-2, 2]}>
              <Button 
                type="text" 
                icon={<BellOutlined />}
                onClick={() => navigate('/dashboard')}
              />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.name}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', minHeight: 280 }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
