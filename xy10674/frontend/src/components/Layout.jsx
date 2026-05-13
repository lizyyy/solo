import React from 'react';
import { Layout, Menu, Avatar, Dropdown } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  InboxOutlined,
  FileTextOutlined,
  HistoryOutlined,
  UserOutlined,
  LogoutOutlined
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;

const LayoutComponent = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '数据概览',
      onClick: () => navigate('/')
    },
    {
      key: '/collections',
      icon: <InboxOutlined />,
      label: '回收记录',
      onClick: () => navigate('/collections')
    },
    {
      key: '/export',
      icon: <FileTextOutlined />,
      label: '导出中心',
      onClick: () => navigate('/export')
    },
    {
      key: '/logs',
      icon: <HistoryOutlined />,
      label: '操作日志',
      onClick: () => navigate('/logs')
    }
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息'
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录'
    }
  ];

  return (
    <Layout className="layout-container">
      <Sider theme="dark" breakpoint="lg" collapsedWidth="0">
        <div className="logo">托盘押金系统</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}
        >
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar icon={<UserOutlined />} />
              <span>管理员</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default LayoutComponent;
