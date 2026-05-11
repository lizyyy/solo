import React from 'react';
import { Layout, Menu, theme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
  AuditOutlined,
  BarChartOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: '仪表盘',
  },
  {
    key: '/shipments',
    icon: <UnorderedListOutlined />,
    label: '运单管理',
  },
  {
    key: '/claims',
    icon: <FileTextOutlined />,
    label: '索赔管理',
  },
  {
    key: '/approval',
    icon: <AuditOutlined />,
    label: '审批中心',
  },
  {
    key: '/report',
    icon: <BarChartOutlined />,
    label: '索赔报表',
  },
];

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const getSelectedKey = () => {
    if (location.pathname.startsWith('/shipments')) return '/shipments';
    if (location.pathname.startsWith('/claims')) return '/claims';
    if (location.pathname.startsWith('/approval')) return '/approval';
    if (location.pathname.startsWith('/report')) return '/report';
    return '/';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible>
        <div style={{ 
          height: 64, 
          margin: 16, 
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 16,
          fontWeight: 'bold'
        }}>
          冷链温控索赔台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {menuItems.find(m => m.key === getSelectedKey())?.label || '冷链温控索赔台'}
          </div>
          <div style={{ color: '#666' }}>客服工作台</div>
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
      </Layout>
    </Layout>
  );
}

export default AppLayout;
