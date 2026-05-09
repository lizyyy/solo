import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Badge } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  ShoppingCartOutlined,
  RollbackOutlined,
  AuditOutlined,
  HistoryOutlined,
  WarningOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Orders from './pages/Orders';
import Returns from './pages/Returns';
import Adjustments from './pages/Adjustments';
import History from './pages/History';
import RiskAlerts from './pages/RiskAlerts';
import { reportApi } from './utils/api';

const { Header, Sider, Content } = Layout;

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    fetchUnreadAlerts();
    const interval = setInterval(fetchUnreadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadAlerts = async () => {
    try {
      const res = await reportApi.getRiskAlerts({ unread_only: true });
      if (res.data.success) {
        setUnreadAlerts(res.data.data.length);
      }
    } catch (error) {
      console.error('获取未读告警失败:', error);
    }
  };

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    if (path.startsWith('/customers')) return 'customers';
    if (path === '/orders') return 'orders';
    if (path === '/returns') return 'returns';
    if (path === '/adjustments') return 'adjustments';
    if (path === '/history') return 'history';
    if (path === '/risk-alerts') return 'risk-alerts';
    return 'dashboard';
  };

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: 'customers', icon: <TeamOutlined />, label: '客户管理' },
    { key: 'orders', icon: <ShoppingCartOutlined />, label: '订单与额度占用' },
    { key: 'returns', icon: <RollbackOutlined />, label: '退货与额度释放' },
    { key: 'adjustments', icon: <AuditOutlined />, label: '调额审批' },
    { key: 'history', icon: <HistoryOutlined />, label: '历史报表' },
    { 
      key: 'risk-alerts', 
      icon: <Badge count={unreadAlerts}><WarningOutlined /></Badge>, 
      label: '风险提示' 
    }
  ];

  const handleMenuClick = ({ key }) => {
    switch (key) {
      case 'dashboard': navigate('/'); break;
      case 'customers': navigate('/customers'); break;
      case 'orders': navigate('/orders'); break;
      case 'returns': navigate('/returns'); break;
      case 'adjustments': navigate('/adjustments'); break;
      case 'history': navigate('/history'); break;
      case 'risk-alerts': navigate('/risk-alerts'); break;
    }
  };

  return (
    <Layout className="layout-container">
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div className="logo">
          {collapsed ? '额度' : '赊销额度管理'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0, paddingLeft: 24, fontSize: 18, fontWeight: 'bold' }}>
          B2B 赊销额度管理系统
        </Header>
        <Content className="content-wrapper">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/adjustments" element={<Adjustments />} />
            <Route path="/history" element={<History />} />
            <Route path="/risk-alerts" element={<RiskAlerts />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
