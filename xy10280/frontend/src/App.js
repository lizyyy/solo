import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  BankOutlined,
  BarChartOutlined,
  SettingOutlined,
  BellOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import Dashboard from './components/Dashboard';
import Stations from './components/Stations';
import Employees from './components/Employees';
import Registrations from './components/Registrations';
import SwipeRecords from './components/SwipeRecords';
import Analytics from './components/Analytics';
import Adjustments from './components/Adjustments';
import Announcements from './components/Announcements';

const { Header, Content, Sider } = Layout;

const menuItems = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: '数据看板', component: Dashboard },
  { key: 'stations', icon: <BankOutlined />, label: '站点管理', component: Stations },
  { key: 'employees', icon: <TeamOutlined />, label: '员工管理', component: Employees },
  { key: 'registrations', icon: <FileTextOutlined />, label: '报名记录', component: Registrations },
  { key: 'swipe', icon: <BarChartOutlined />, label: '刷卡记录', component: SwipeRecords },
  { key: 'analytics', icon: <BarChartOutlined />, label: '热度分析', component: Analytics },
  { key: 'adjustments', icon: <SettingOutlined />, label: '调整任务', component: Adjustments },
  { key: 'announcements', icon: <BellOutlined />, label: '调整公告', component: Announcements },
];

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeKey, setActiveKey] = useState('dashboard');
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const ActiveComponent = menuItems.find(item => item.key === activeKey)?.component || Dashboard;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
          {collapsed ? '班车' : '企业班车系统'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[activeKey]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => setActiveKey(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{ padding: '0 24px', fontSize: '18px', fontWeight: 'bold' }}>
            企业班车站点热度调整台
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG, minHeight: 280 }}>
          <ActiveComponent />
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
