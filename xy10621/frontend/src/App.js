import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, ConfigProvider, theme } from 'antd';
import { CameraOutlined, UnorderedListOutlined, FileTextOutlined } from '@ant-design/icons';
import RentalList from './pages/RentalList';
import RentalDetail from './pages/RentalDetail';
import Report from './pages/Report';

const { Header, Content, Sider } = Layout;

function App() {
  const [collapsed, setCollapsed] = useState(false);

  const items = [
    { key: '1', icon: <UnorderedListOutlined />, label: <Link to="/">租借列表</Link> },
    { key: '2', icon: <FileTextOutlined />, label: <Link to="/report">报告导出</Link> },
  ];

  return (
    <Router>
      <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
        <Layout style={{ minHeight: '100vh' }}>
          <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
            <div style={{ height: 32, margin: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
              {!collapsed && <CameraOutlined style={{ marginRight: 8 }} />}
              {!collapsed ? '器材租借' : '租借'}
            </div>
            <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline" items={items} />
          </Sider>
          <Layout>
            <Header style={{ padding: 0, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <h1 style={{ marginLeft: 24, fontSize: 20 }}>影棚器材租借验收系统</h1>
            </Header>
            <Content style={{ margin: '16px', background: '#f0f2f5' }}>
              <Routes>
                <Route path="/" element={<RentalList />} />
                <Route path="/rental/:id" element={<RentalDetail />} />
                <Route path="/report" element={<Report />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </ConfigProvider>
    </Router>
  );
}

export default App;
