import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, message, App as AntdApp } from 'antd';
import {
  HomeOutlined,
  ImportOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  EditOutlined,
  HistoryOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import PredictionPage from './pages/PredictionPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import ReviewPage from './pages/ReviewPage.jsx';
import CorrectionPage from './pages/CorrectionPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import ExportPage from './pages/ExportPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import api from './utils/api.js';

const { Header, Sider, Content } = Layout;

function App() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { message } = AntdApp.useApp();

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      await api.get('/health', { showError: false });
    } catch (error) {
      message.warning('后端服务连接失败，请确认后端服务已启动（端口 8000）');
    }
  };

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">首页概览</Link>,
    },
    {
      key: '/prediction',
      icon: <BarChartOutlined />,
      label: <Link to="/prediction">备餐预测</Link>,
    },
    {
      key: '/import',
      icon: <ImportOutlined />,
      label: <Link to="/import">数据导入</Link>,
    },
    {
      key: '/review',
      icon: <CheckCircleOutlined />,
      label: <Link to="/review">数据复核</Link>,
    },
    {
      key: '/correction',
      icon: <EditOutlined />,
      label: <Link to="/correction">数据修正</Link>,
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: <Link to="/history">历史记录</Link>,
    },
    {
      key: '/export',
      icon: <DownloadOutlined />,
      label: <Link to="/export">数据导出</Link>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>
            🍚 食堂备餐预测系统
          </span>
          <span style={{ fontSize: 12, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 4 }}>
            v1.0
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={checkHealth}
            size="small"
          >
            刷新连接
          </Button>
        </div>
      </Header>
      <Layout>
        <Sider
          width={200}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{
            background: '#fff',
            borderRight: '1px solid #e5e7eb',
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Content style={{ background: '#f5f7fa' }}>
          <div style={{ padding: 24, minHeight: 'calc(100vh - 64px)' }}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/prediction" element={<PredictionPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/correction" element={<CorrectionPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/export" element={<ExportPage />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
