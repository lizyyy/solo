import React from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  GiftOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import CouponPackages from './pages/CouponPackages';
import Verifications from './pages/Verifications';
import Refunds from './pages/Refunds';
import AuditLogs from './pages/AuditLogs';
import Reports from './pages/Reports';
import Import from './pages/Import';

const { Header, Content, Sider } = Layout;

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '异常看板' },
    { key: '/members', icon: <TeamOutlined />, label: '会员管理' },
    { key: '/coupon-packages', icon: <GiftOutlined />, label: '活动券包' },
    { key: '/verifications', icon: <CheckCircleOutlined />, label: '核销记录' },
    { key: '/refunds', icon: <RollbackOutlined />, label: '退款记录' },
    { key: '/import', icon: <CloudUploadOutlined />, label: '批量导入' },
    { key: '/reports', icon: <BarChartOutlined />, label: '统计报表' },
    { key: '/audit-logs', icon: <FileSearchOutlined />, label: '操作日志' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 20px' }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
          商场活动券退款返还系统
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/coupon-packages" element={<CouponPackages />} />
              <Route path="/verifications" element={<Verifications />} />
              <Route path="/refunds" element={<Refunds />} />
              <Route path="/import" element={<Import />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
