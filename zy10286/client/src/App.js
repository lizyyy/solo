import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme, Badge, Typography } from 'antd';
import { 
  DashboardOutlined, 
  TeamOutlined, 
  VideoCameraOutlined, 
  SafetyOutlined, 
  WarningOutlined,
  FileTextOutlined,
  UserSwitchOutlined,
  DollarOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import Students from './pages/Students';
import Sessions from './pages/Sessions';
import Permissions from './pages/Permissions';
import Anomalies from './pages/Anomalies';
import Logs from './pages/Logs';
import StudentTimeline from './pages/StudentTimeline';
import './App.css';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const location = useLocation();
  const { token: { colorBgContainer } } = theme.useToken();

  useEffect(() => {
    fetchAnomalyCount();
  }, []);

  const fetchAnomalyCount = async () => {
    try {
      const response = await fetch('/api/anomalies?status=open');
      const data = await response.json();
      setAnomalyCount(data.length);
    } catch (error) {
      console.error('获取异常数量失败:', error);
    }
  };

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: <Link to="/">控制台</Link> },
    { key: '/classes', icon: <TeamOutlined />, label: <Link to="/classes">班级管理</Link> },
    { key: '/students', icon: <UserSwitchOutlined />, label: <Link to="/students">学员管理</Link> },
    { key: '/sessions', icon: <VideoCameraOutlined />, label: <Link to="/sessions">直播场次</Link> },
    { key: '/permissions', icon: <SafetyOutlined />, label: <Link to="/permissions">权限管理</Link> },
    { 
      key: '/anomalies', 
      icon: <Badge count={anomalyCount} size="small"><WarningOutlined /></Badge>, 
      label: <Link to="/anomalies">异常检测</Link> 
    },
    { key: '/logs', icon: <HistoryOutlined />, label: <Link to="/logs">访问日志</Link> }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.1)',
          margin: 16,
          borderRadius: 8
        }}>
          <SafetyOutlined style={{ fontSize: 24, color: '#fff' }} />
          {!collapsed && <span style={{ color: '#fff', marginLeft: 8, fontWeight: 'bold' }}>授权台</span>}
        </div>
        <Menu 
          theme="dark" 
          selectedKeys={[location.pathname]} 
          mode="inline" 
          items={menuItems} 
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Title level={4} style={{ margin: 0 }}>课程直播回放授权管理系统</Title>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, minHeight: 280 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/students" element={<Students />} />
            <Route path="/students/:id" element={<StudentTimeline />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/permissions" element={<Permissions />} />
            <Route path="/anomalies" element={<Anomalies onResolve={fetchAnomalyCount} />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
