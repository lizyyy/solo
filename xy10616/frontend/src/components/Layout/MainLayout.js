import React from 'react';
import { Layout, Menu } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  CarOutlined,
  MoneyCollectOutlined,
  WarningOutlined,
  FileTextOutlined,
  HistoryOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '异常看板',
    },
    {
      key: '/plate-binding',
      icon: <CarOutlined />,
      label: '车牌绑定',
    },
    {
      key: '/arrears',
      icon: <MoneyCollectOutlined />,
      label: '欠费账本',
    },
    {
      key: '/renewal',
      icon: <MoneyCollectOutlined />,
      label: '续费支付',
    },
    {
      key: '/blacklist',
      icon: <WarningOutlined />,
      label: '黑名单管理',
    },
    {
      key: '/flow-records',
      icon: <HistoryOutlined />,
      label: '流转记录',
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: '报表导出',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <h1 style={{ color: '#fff', margin: 0, lineHeight: '64px' }}>停车月卡续费对账系统</h1>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              background: '#fff',
              borderRadius: 8,
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
