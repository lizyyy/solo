import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { 
  DashboardOutlined, 
  UserOutlined, 
  InboxOutlined, 
  CheckCircleOutlined,
  CreditCardOutlined,
  GiftOutlined,
  MessageOutlined
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import Residents from './pages/Residents';
import Deliveries from './pages/Deliveries';
import Inspections from './pages/Inspections';
import PointsFlow from './pages/PointsFlow';
import Exchange from './pages/Exchange';
import Complaints from './pages/Complaints';

const { Header, Sider, Content } = Layout;

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '数据看板' },
    { key: '/residents', icon: <UserOutlined />, label: '居民管理' },
    { key: '/deliveries', icon: <InboxOutlined />, label: '投递记录' },
    { key: '/inspections', icon: <CheckCircleOutlined />, label: '抽检结果' },
    { key: '/points', icon: <CreditCardOutlined />, label: '积分流水' },
    { key: '/exchange', icon: <GiftOutlined />, label: '兑换管理' },
    { key: '/complaints', icon: <MessageOutlined />, label: '申诉处理' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 64, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }} />
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', fontSize: 18, fontWeight: 'bold' }}>
          社区垃圾分类积分台
        </Header>
        <Content style={{ margin: '16px' }}>
          <div className="site-layout-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/residents" element={<Residents />} />
              <Route path="/deliveries" element={<Deliveries />} />
              <Route path="/inspections" element={<Inspections />} />
              <Route path="/points" element={<PointsFlow />} />
              <Route path="/exchange" element={<Exchange />} />
              <Route path="/complaints" element={<Complaints />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
