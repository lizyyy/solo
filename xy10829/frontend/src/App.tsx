import { useState, useEffect } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  SettingOutlined,
  ApiOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import RetryBatches from './pages/RetryBatches';
import Settings from './pages/Settings';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('1');

  useEffect(() => {
    const path = location.pathname;
    if (path === '/') setSelectedKey('1');
    else if (path.startsWith('/events')) setSelectedKey('2');
    else if (path === '/retry-batches') setSelectedKey('3');
    else if (path === '/settings') setSelectedKey('4');
  }, [location.pathname]);

  const menuItems = [
    {
      key: '1',
      icon: <DashboardOutlined />,
      label: '总览',
      onClick: () => navigate('/')
    },
    {
      key: '2',
      icon: <ExclamationCircleOutlined />,
      label: '超时事件',
      onClick: () => navigate('/events')
    },
    {
      key: '3',
      icon: <HistoryOutlined />,
      label: '补发批次',
      onClick: () => navigate('/retry-batches')
    },
    {
      key: '4',
      icon: <SettingOutlined />,
      label: '配置管理',
      onClick: () => navigate('/settings')
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 14 : 18,
          fontWeight: 'bold'
        }}>
          <ApiOutlined style={{ marginRight: collapsed ? 0 : 8 }} />
          {!collapsed && 'SLA 回调站'}
        </div>
        <Menu theme="dark" selectedKeys={[selectedKey]} mode="inline" items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: 0, 
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 24
        }}>
          <h2 style={{ margin: 0 }}>SLA 超时回调管理控制台</h2>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/retry-batches" element={<RetryBatches />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
