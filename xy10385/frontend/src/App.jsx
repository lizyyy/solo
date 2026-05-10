import React, { useState } from 'react';
import { Layout, Menu, Typography, theme } from 'antd';
import {
  AppstoreOutlined,
  ScheduleOutlined,
  CalendarOutlined,
  FileCheckOutlined,
  MoneyCollectOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import CreateOrderPage from './pages/CreateOrderPage';
import SchedulePage from './pages/SchedulePage';
import ApprovalsPage from './pages/ApprovalsPage';
import FeesPage from './pages/FeesPage';
import ReportPage from './pages/ReportPage';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/orders', icon: <AppstoreOutlined />, label: '订单列表' },
  { key: '/schedule', icon: <CalendarOutlined />, label: '陪诊员日程' },
  { key: '/approvals', icon: <FileCheckOutlined />, label: '加项审批' },
  { key: '/fees', icon: <MoneyCollectOutlined />, label: '费用明细' },
  { key: '/report', icon: <FileTextOutlined />, label: '报告导出' }
];

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selectedKey = location.pathname.startsWith('/orders/') 
    ? '/orders' 
    : location.pathname === '/' ? '/orders' : location.pathname;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div className="logo">
          {collapsed ? '陪诊' : '陪诊订单协调台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: colorBgContainer }}>
          <Title level={4} style={{ margin: 0, lineHeight: '64px' }}>
            医院陪诊订单协调台
          </Title>
        </Header>
        <Content
          style={{
            margin: '16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Routes>
            <Route path="/" element={<OrdersPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/new" element={<CreateOrderPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/fees" element={<FeesPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
