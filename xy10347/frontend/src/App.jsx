import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  FileTextOutlined,
  MoneyCollectOutlined,
  ExclamationCircleOutlined,
  SettingOutlined
} from '@ant-design/icons';

import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import TeamLeaders from './pages/TeamLeaders';
import Settlements from './pages/Settlements';
import Refunds from './pages/Refunds';
import PriceChangeRequests from './pages/PriceChangeRequests';

const { Header, Content, Sider } = Layout;

function App() {
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">仪表盘</Link>
    },
    {
      key: '/orders',
      icon: <ShoppingCartOutlined />,
      label: <Link to="/orders">订单管理</Link>
    },
    {
      key: '/team-leaders',
      icon: <TeamOutlined />,
      label: <Link to="/team-leaders">团长管理</Link>
    },
    {
      key: '/settlements',
      icon: <FileTextOutlined />,
      label: <Link to="/settlements">结算管理</Link>
    },
    {
      key: '/refunds',
      icon: <MoneyCollectOutlined />,
      label: <Link to="/refunds">退款处理</Link>
    },
    {
      key: '/price-change-requests',
      icon: <ExclamationCircleOutlined />,
      label: <Link to="/price-change-requests">改价审批</Link>
    }
  ];

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="app-logo">社群课程返佣结算台</div>
      </Header>
      <Layout>
        <Sider width={200} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout>
          <Content className="app-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/team-leaders" element={<TeamLeaders />} />
              <Route path="/settlements" element={<Settlements />} />
              <Route path="/refunds" element={<Refunds />} />
              <Route path="/price-change-requests" element={<PriceChangeRequests />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
