import React, { useState, useEffect } from 'react';
import { Layout, Menu, notification } from 'antd';
import {
  DashboardOutlined,
  ImportOutlined,
  BarChartOutlined,
  FileTextOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import DataImport from './pages/DataImport';
import Analysis from './pages/Analysis';
import Export from './pages/Export';
import Settings from './pages/Settings';
import api from './services/api';

const { Header, Sider, Content } = Layout;

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [apiHealth, setApiHealth] = useState(true);

  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      await api.get('/health');
      setApiHealth(true);
    } catch (error) {
      console.error('API健康检查失败:', error);
      setApiHealth(false);
      notification.error({
        message: '后端服务连接失败',
        description: '请确保后端服务正在运行在端口5000',
        duration: 0
      });
    }
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/import',
      icon: <ImportOutlined />,
      label: '数据导入',
    },
    {
      key: '/analysis',
      icon: <BarChartOutlined />,
      label: '舱房分析',
    },
    {
      key: '/export',
      icon: <FileTextOutlined />,
      label: '数据导出',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ];

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return '/';
    const item = menuItems.find(m => path.startsWith(m.key));
    return item ? item.key : '/';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <h1 style={{ color: 'white', margin: 0, fontSize: '20px' }}>
          🚢 邮轮客舱维护工具
        </h1>
        {!apiHealth && (
          <span style={{ color: '#ff4d4f', marginLeft: '20px', fontSize: '14px' }}>
            ⚠️ 后端服务未连接
          </span>
        )}
      </Header>
      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          theme="dark"
        >
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: 'white',
              borderRadius: '8px',
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/import" element={<DataImport />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/export" element={<Export />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
