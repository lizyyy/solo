import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, ConfigProvider, theme } from 'antd';
import { 
  DashboardOutlined, 
  ExperimentOutlined, 
  BarChartOutlined, 
  SettingOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import ExperimentList from './pages/ExperimentList';
import ExperimentDetail from './pages/ExperimentDetail';
import ExperimentCreate from './pages/ExperimentCreate';
import ResultsView from './pages/ResultsView';

const { Header, Sider, Content } = Layout;

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">仪表盘</Link>,
    },
    {
      key: '/experiments',
      icon: <ExperimentOutlined />,
      label: <Link to="/experiments">实验管理</Link>,
    },
    {
      key: '/experiments/create',
      icon: <SettingOutlined />,
      label: <Link to="/experiments/create">创建实验</Link>,
    },
    {
      key: '/results',
      icon: <BarChartOutlined />,
      label: <Link to="/results">结果分析</Link>,
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: <Link to="/reports">报告导出</Link>,
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <Router>
        <Layout style={{ minHeight: '100vh' }}>
          <Sider 
            collapsible 
            collapsed={collapsed} 
            onCollapse={(value) => setCollapsed(value)}
            theme={darkMode ? 'dark' : 'light'}
          >
            <div style={{ 
              height: 64, 
              margin: 16, 
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8
            }}>
              <span style={{ color: darkMode ? '#fff' : '#000', fontWeight: 'bold', fontSize: collapsed ? 12 : 16 }}>
                {collapsed ? 'Cache' : '缓存实验台'}
              </span>
            </div>
            <Menu 
              theme={darkMode ? 'dark' : 'light'}
              defaultSelectedKeys={['/']} 
              mode="inline" 
              items={menuItems} 
            />
          </Sider>
          <Layout>
            <Header style={{ 
              padding: '0 24px', 
              background: darkMode ? '#141414' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 4px rgba(0,21,41,0.08)'
            }}>
              <span style={{ fontSize: 18, fontWeight: 'bold' }}>
                缓存链路实验台 - Cache Lab
              </span>
            </Header>
            <Content style={{ margin: '24px 16px', padding: 24, background: darkMode ? '#141414' : '#fff', minHeight: 280 }}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/experiments" element={<ExperimentList />} />
                <Route path="/experiments/create" element={<ExperimentCreate />} />
                <Route path="/experiments/:id" element={<ExperimentDetail />} />
                <Route path="/results" element={<ResultsView />} />
                <Route path="/results/:id" element={<ResultsView />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </Router>
    </ConfigProvider>
  );
};

export default App;
