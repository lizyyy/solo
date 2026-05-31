import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, theme, Badge } from 'antd';
import {
  UploadOutlined,
  UnorderedListOutlined,
  EditOutlined,
  HistoryOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import ImportPage from './pages/ImportPage';
import ArtworkListPage from './pages/ArtworkListPage';
import ReviewPage from './pages/ReviewPage';
import HistoryPage from './pages/HistoryPage';
import ExportPage from './pages/ExportPage';

const { Header, Content, Sider } = Layout;

function App() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  
  const location = useLocation();
  
  const menuItems = [
    {
      key: '/',
      icon: <UploadOutlined />,
      label: <Link to="/">导入数据</Link>,
    },
    {
      key: '/artworks',
      icon: <UnorderedListOutlined />,
      label: <Link to="/artworks">作品列表</Link>,
    },
    {
      key: '/review',
      icon: (
        <Badge dot>
          <ExclamationCircleOutlined />
        </Badge>
      ),
      label: <Link to="/review">复核修正</Link>,
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: <Link to="/history">版本历史</Link>,
    },
    {
      key: '/export',
      icon: <DownloadOutlined />,
      label: <Link to="/export">导出数据</Link>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#001529',
          padding: '0 24px',
        }}
      >
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
          🎨 青年艺术展挂墙管理系统
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: colorBgContainer }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Routes>
              <Route path="/" element={<ImportPage />} />
              <Route path="/artworks" element={<ArtworkListPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/export" element={<ExportPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
