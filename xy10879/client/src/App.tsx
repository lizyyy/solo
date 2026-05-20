import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  BlockOutlined,
  CheckCircleOutlined,
  GiftOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import BlockEvents from './pages/BlockEvents';
import AllowRecords from './pages/AllowRecords';
import PromoCodes from './pages/PromoCodes';
import RiskTest from './pages/RiskTest';
import './App.css';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '控制台总览',
    },
    {
      key: '/block-events',
      icon: <BlockOutlined />,
      label: '拦截事件',
    },
    {
      key: '/allow-records',
      icon: <CheckCircleOutlined />,
      label: '放行记录',
    },
    {
      key: '/promo-codes',
      icon: <GiftOutlined />,
      label: '优惠码管理',
    },
    {
      key: '/risk-test',
      icon: <BarChartOutlined />,
      label: '风控测试',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 14 : 18,
          fontWeight: 'bold',
        }}>
          {collapsed ? '风控' : '优惠码风控系统'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
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
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <h2 style={{ margin: 0 }}>优惠码滥用风控管理控制台</h2>
          <div style={{ color: '#666' }}>为运营和研发团队提供风控决策支持</div>
        </Header>
        <Content style={{ margin: '24px', overflow: 'initial' }}>
          <div style={{
            padding: 24,
            minHeight: 360,
            background: colorBgContainer,
            borderRadius: 8,
          }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/block-events" element={<BlockEvents />} />
              <Route path="/allow-records" element={<AllowRecords />} />
              <Route path="/promo-codes" element={<PromoCodes />} />
              <Route path="/risk-test" element={<RiskTest />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
