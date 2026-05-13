import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme } from 'antd';
import { 
  FileTextOutlined, 
  DashboardOutlined, 
  WarningOutlined, 
  BarChartOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ContractList from './pages/ContractList';
import ExceptionBoard from './pages/ExceptionBoard';
import ReportPage from './pages/ReportPage';
import ChangeLog from './pages/ChangeLog';

const { Header, Content, Sider } = Layout;

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '数据看板' },
    { key: '/contracts', icon: <FileTextOutlined />, label: '合同列表' },
    { key: '/exceptions', icon: <WarningOutlined />, label: '异常看板' },
    { key: '/reports', icon: <BarChartOutlined />, label: '报告导出' },
    { key: '/changelogs', icon: <HistoryOutlined />, label: '变更记录' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
          {collapsed ? 'CM' : '合同管理系统'}
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
        <Header style={{ padding: 0, background: colorBgContainer, borderBottom: '1px solid #f0f0f0' }}>
          <h2 style={{ marginLeft: 24, lineHeight: '64px' }}>合同归档续约管理系统</h2>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, borderRadius: 6 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contracts" element={<ContractList />} />
            <Route path="/exceptions" element={<ExceptionBoard />} />
            <Route path="/reports" element={<ReportPage />} />
            <Route path="/changelogs" element={<ChangeLog />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
