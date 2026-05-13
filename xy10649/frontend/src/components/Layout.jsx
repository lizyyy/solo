import React from 'react';
import { Layout as AntLayout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  GiftOutlined,
  CalendarOutlined,
  UserOutlined,
  ShoppingOutlined,
  TruckOutlined,
  RollbackOutlined,
  WarningOutlined,
  FileTextOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = AntLayout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/inventory', icon: <GiftOutlined />, label: '礼品库存' },
  { key: '/plans', icon: <CalendarOutlined />, label: '活动计划' },
  { key: '/customers', icon: <UserOutlined />, label: '客户名单' },
  { key: '/claims', icon: <ShoppingOutlined />, label: '员工领用' },
  { key: '/express', icon: <TruckOutlined />, label: '快递单号' },
  { key: '/returns', icon: <RollbackOutlined />, label: '退回入库' },
  { key: '/exceptions', icon: <WarningOutlined />, label: '异常看板' },
  { key: '/reports', icon: <FileTextOutlined />, label: '报表导出' }
];

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#001529', padding: '0 24px' }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
          企业礼品客户发放管理系统
        </div>
      </Header>
      <AntLayout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
        <Content style={{ padding: '24px', background: '#f0f2f5' }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
}

export default Layout;
