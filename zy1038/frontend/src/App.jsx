import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, Badge, message } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  PartitionOutlined,
  FlagOutlined,
  TeamOutlined,
  BarChartOutlined,
  HistoryOutlined,
  DownloadOutlined,
  UploadOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/Users';
import SegmentsPage from './pages/Segments';
import FlagsPage from './pages/Flags';
import SingleEvaluationPage from './pages/SingleEvaluation';
import BatchEvaluationPage from './pages/BatchEvaluation';
import AuditPage from './pages/Audit';
import ImportExportPage from './pages/ImportExport';
import ReportPage from './pages/Report';
import api from './services/api';

const { Header, Sider, Content } = Layout;

function App() {
  const [stats, setStats] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">仪表盘</Link>
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: <Link to="/users">用户样本</Link>,
      badge: stats?.users
    },
    {
      key: '/segments',
      icon: <PartitionOutlined />,
      label: <Link to="/segments">Segment 规则</Link>,
      badge: stats?.segments
    },
    {
      key: '/flags',
      icon: <FlagOutlined />,
      label: <Link to="/flags">Feature Flags</Link>,
      badge: stats?.flags
    },
    {
      key: '/evaluate/single',
      icon: <TeamOutlined />,
      label: <Link to="/evaluate/single">单用户演练</Link>
    },
    {
      key: '/evaluate/batch',
      icon: <BarChartOutlined />,
      label: <Link to="/evaluate/batch">批量演练</Link>
    },
    {
      key: '/audit',
      icon: <HistoryOutlined />,
      label: <Link to="/audit">审计记录</Link>,
      badge: stats?.audit
    },
    {
      key: '/import-export',
      icon: <DownloadOutlined />,
      label: <Link to="/import-export">导入导出</Link>
    },
    {
      key: '/report',
      icon: <FileTextOutlined />,
      label: <Link to="/report">演练报告</Link>
    }
  ];

  return (
    <BrowserRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          theme="dark"
        >
          <div style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: collapsed ? '14px' : '18px',
            fontWeight: 'bold',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            {collapsed ? 'FF' : 'Feature Flag'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[window.location.pathname]}
            items={menuItems.map(item => ({
              key: item.key,
              icon: item.icon,
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.label}
                  {item.badge && (
                    <Badge
                      count={item.badge}
                      size="small"
                      style={{ marginLeft: 'auto' }}
                    />
                  )}
                </span>
              )
            }))}
          />
        </Sider>
        <Layout>
          <Header style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <h2 style={{ margin: 0, color: '#1a1a1a' }}>
              灰度规则演练台
            </h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              {stats && (
                <div style={{ display: 'flex', gap: '16px', color: '#666', fontSize: '14px' }}>
                  <span>用户: {stats.users}</span>
                  <span>Segment: {stats.segments}</span>
                  <span>Flag: {stats.flags}</span>
                </div>
              )}
            </div>
          </Header>
          <Content style={{
            margin: '24px',
            padding: '24px',
            background: '#fff',
            borderRadius: '8px',
            minHeight: 'calc(100vh - 180px)'
          }}>
            <Routes>
              <Route path="/" element={<Dashboard onRefresh={loadStats} />} />
              <Route path="/users" element={<UsersPage onRefresh={loadStats} />} />
              <Route path="/segments" element={<SegmentsPage onRefresh={loadStats} />} />
              <Route path="/flags" element={<FlagsPage onRefresh={loadStats} />} />
              <Route path="/evaluate/single" element={<SingleEvaluationPage />} />
              <Route path="/evaluate/batch" element={<BatchEvaluationPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/import-export" element={<ImportExportPage onRefresh={loadStats} />} />
              <Route path="/report" element={<ReportPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
