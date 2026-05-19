import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout, Typography } from 'antd';
import { FileTextOutlined, HistoryOutlined, DashboardOutlined, SettingOutlined } from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Contracts from './pages/Contracts';
import History from './pages/History';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '总览' },
  { key: '/contracts', icon: <FileTextOutlined />, label: '合约管理' },
  { key: '/history', icon: <HistoryOutlined />, label: '回放历史' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
];

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider theme="dark" width={200}>
          <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#001529' }}>
            <Title level={4} style={{ color: 'white', margin: 0 }}>Mock 回放器</Title>
          </div>
          <Sidebar items={menuItems} />
        </Sider>
        <Layout>
          <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
            <Title level={4} style={{ margin: 0, lineHeight: '64px' }}>Mock 合约回放控制台</Title>
          </Header>
          <Content style={{ margin: '24px', background: '#fff', padding: 24, borderRadius: 8 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}

export default App;
