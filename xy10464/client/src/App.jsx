import React, { useState, useEffect } from 'react';
import { Layout, Menu, Spin, message } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  ToolOutlined,
  WarningOutlined,
  CalculatorOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import Contracts from './pages/Contracts';
import WorkOrders from './pages/WorkOrders';
import WorkOrderDetail from './pages/WorkOrderDetail';
import Exemptions from './pages/Exemptions';
import Settlements from './pages/Settlements';
import SettlementDetail from './pages/SettlementDetail';

const { Header, Sider, Content } = Layout;

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          setLoading(false);
        } else {
          message.error('后端服务不可用');
        }
      } catch (error) {
        message.error('连接后端服务失败');
        setLoading(false);
      }
    };

    checkHealth();
  }, []);

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表盘'
    },
    {
      key: '/contracts',
      icon: <FileTextOutlined />,
      label: '合同管理'
    },
    {
      key: '/workorders',
      icon: <ToolOutlined />,
      label: '工单管理'
    },
    {
      key: '/exemptions',
      icon: <WarningOutlined />,
      label: '免责申请'
    },
    {
      key: '/settlements',
      icon: <CalculatorOutlined />,
      label: '结算管理'
    }
  ];

  const getSelectedKey = () => {
    if (location.pathname.startsWith('/workorders/')) return '/workorders';
    if (location.pathname.startsWith('/settlements/')) return '/settlements';
    return location.pathname;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <Layout className="app-layout">
      <Sider theme="dark" collapsed={false}>
        <div className="logo">维修SLA罚款台</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0, paddingLeft: 24 }}>
          <h2 style={{ margin: 0 }}>维修SLA罚款管理系统</h2>
        </Header>
        <Content style={{ margin: '16px', overflow: 'initial' }}>
          <div className="site-layout-background">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/workorders" element={<WorkOrders />} />
              <Route path="/workorders/:id" element={<WorkOrderDetail />} />
              <Route path="/exemptions" element={<Exemptions />} />
              <Route path="/settlements" element={<Settlements />} />
              <Route path="/settlements/:id" element={<SettlementDetail />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
