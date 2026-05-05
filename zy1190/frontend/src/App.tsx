import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, theme, Spin, message } from 'antd';
import { 
  DashboardOutlined, 
  ExperimentOutlined, 
  BarChartOutlined, 
  SettingOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import ExperimentList from './pages/ExperimentList';
import ExperimentDetail from './pages/ExperimentDetail';
import NewExperiment from './pages/NewExperiment';
import ComparisonList from './pages/ComparisonList';
import ComparisonDetail from './pages/ComparisonDetail';
import { healthCheck } from './services/api';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backendOk, setBackendOk] = useState(false);

  useEffect(() => {
    checkBackend();
  }, []);

  const checkBackend = async () => {
    try {
      const response = await healthCheck();
      setBackendOk(response.data.status === 'ok');
    } catch (error) {
      console.error('Backend check failed:', error);
      message.warning('后端服务未运行，请启动后端服务');
      setBackendOk(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">仪表盘</Link>,
    },
    {
      key: '/experiments',
      icon: <ExperimentOutlined />,
      label: <Link to="/experiments">实验列表</Link>,
    },
    {
      key: '/experiments/new',
      icon: <PlayCircleOutlined />,
      label: <Link to="/experiments/new">新建实验</Link>,
    },
    {
      key: '/comparisons',
      icon: <BarChartOutlined />,
      label: <Link to="/comparisons">对比分析</Link>,
    },
  ];

  return (
    <BrowserRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
          <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 6 }} />
          <Menu theme="dark" defaultSelectedKeys={['/']} mode="inline" items={menuItems} />
        </Sider>
        <Layout>
          <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              Cache Lab - CPU Cache 性能实验台
            </span>
            {backendOk ? (
              <span style={{ color: '#52c41a', fontSize: 12 }}>
                ✅ 后端已连接
              </span>
            ) : (
              <span style={{ color: '#ff4d4f', fontSize: 12 }}>
                ⚠️ 后端未连接
              </span>
            )}
          </Header>
          <Content style={{ margin: '16px', padding: 24, background: '#f0f2f5', minHeight: 280 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/experiments" element={<ExperimentList />} />
              <Route path="/experiments/new" element={<NewExperiment />} />
              <Route path="/experiments/:id" element={<ExperimentDetail />} />
              <Route path="/comparisons" element={<ComparisonList />} />
              <Route path="/comparisons/:id" element={<ComparisonDetail />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
