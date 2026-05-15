import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  FileTextOutlined,
  BarChartOutlined,
  UploadOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import AppealList from './pages/AppealList';
import AppealDetail from './pages/AppealDetail';
import ReportPage from './pages/ReportPage';
import ImportPage from './pages/ImportPage';

const { Header, Content, Sider } = Layout;

function App() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/',
      icon: <FileTextOutlined />,
      label: <Link to="/">申诉列表</Link>,
    },
    {
      key: '/import',
      icon: <UploadOutlined />,
      label: <Link to="/import">批量导入</Link>,
    },
    {
      key: '/report',
      icon: <BarChartOutlined />,
      label: <Link to="/report">报告下载</Link>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={200}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 16,
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          内容审核申诉
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['/']}
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
          <h2 style={{ margin: 0 }}>内容审核申诉管理系统</h2>
        </Header>
        <Content style={{
          margin: '24px',
          padding: 24,
          minHeight: 280,
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
        }}>
          <Routes>
            <Route path="/" element={<AppealList />} />
            <Route path="/appeal/:id" element={<AppealDetail />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
