import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  WarningOutlined,
  AuditOutlined,
  ImportOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Policies from './pages/Policies';
import Incidents from './pages/Incidents';
import Claims from './pages/Claims';
import ImportExport from './pages/ImportExport';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">风险看板</Link> },
  { key: '/members', icon: <TeamOutlined />, label: <Link to="/members">家庭成员</Link> },
  { key: '/policies', icon: <FileTextOutlined />, label: <Link to="/policies">保单管理</Link> },
  { key: '/incidents', icon: <WarningOutlined />, label: <Link to="/incidents">出险事件</Link> },
  { key: '/claims', icon: <AuditOutlined />, label: <Link to="/claims">理赔进度</Link> },
  { key: '/import-export', icon: <ImportOutlined />, label: <Link to="/import-export">导入导出</Link> },
];

const App: React.FC = () => {
  const { token: { colorBgContainer } } = theme.useToken();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{
          height: 64,
          margin: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold',
        }}>
          🛡️ 保险管家
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }} />
        <Content style={{ margin: '24px 16px', minHeight: 280 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/members" element={<Members />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/claims" element={<Claims />} />
            <Route path="/import-export" element={<ImportExport />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
