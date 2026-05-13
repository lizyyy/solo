import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  TruckOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  AlertOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Deliveries from './pages/Deliveries';
import Inspections from './pages/Inspections';
import Reports from './pages/Reports';
import ExceptionBoard from './pages/ExceptionBoard';

const { Header, Content, Sider } = Layout;

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('dashboard');
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '数据概览' },
    { key: 'orders', icon: <ShoppingOutlined />, label: '材料订单' },
    { key: 'deliveries', icon: <TruckOutlined />, label: '送货管理' },
    { key: 'inspections', icon: <CheckSquareOutlined />, label: '验收记录' },
    { key: 'exceptions', icon: <AlertOutlined />, label: '异常看板' },
    { key: 'reports', icon: <FileTextOutlined />, label: '报表导出' }
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case 'dashboard':
        return <Dashboard />;
      case 'orders':
        return <Orders />;
      case 'deliveries':
        return <Deliveries />;
      case 'inspections':
        return <Inspections />;
      case 'exceptions':
        return <ExceptionBoard />;
      case 'reports':
        return <Reports />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div className="logo" style={{ padding: '16px', color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
          {collapsed ? 'MA' : '材料验收系统'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selectedKey]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => setSelectedKey(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{ paddingLeft: '24px', fontSize: '16px' }}>
            <strong>装修材料进场验收管理系统</strong>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 360, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
