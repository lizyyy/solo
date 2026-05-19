import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  SettingOutlined,
  CloudServerOutlined,
  DeploymentUnitOutlined,
  DownloadOutlined,
  FileDiffOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import OverviewPage from './pages/Overview';
import ConfigsPage from './pages/Configs';
import InstancesPage from './pages/Instances';
import DistributionsPage from './pages/Distributions';
import PullRecordsPage from './pages/PullRecords';
import DiffReportsPage from './pages/DiffReports';
import FailedDetailsPage from './pages/FailedDetails';

const { Header, Content, Sider } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '总览' },
  { key: '/configs', icon: <SettingOutlined />, label: '配置项' },
  { key: '/instances', icon: <CloudServerOutlined />, label: '服务实例' },
  { key: '/distributions', icon: <DeploymentUnitOutlined />, label: '分发版本' },
  { key: '/pulls', icon: <DownloadOutlined />, label: '拉取记录' },
  { key: '/diff-reports', icon: <FileDiffOutlined />, label: '差异报告' },
  { key: '/failed', icon: <ExclamationCircleOutlined />, label: '异常详情' },
];

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const handleMenuClick = (e: { key: string }) => {
    navigate(e.key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: collapsed ? 16 : 18,
            fontWeight: 'bold',
            background: 'rgba(255,255,255,0.1)',
          }}
        >
          {collapsed ? '配置' : '配置分发一致性台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }} />
        <Content>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/configs" element={<ConfigsPage />} />
            <Route path="/instances" element={<InstancesPage />} />
            <Route path="/distributions" element={<DistributionsPage />} />
            <Route path="/pulls" element={<PullRecordsPage />} />
            <Route path="/diff-reports" element={<DiffReportsPage />} />
            <Route path="/failed" element={<FailedDetailsPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
