import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  DatabaseOutlined,
  ExperimentOutlined,
  BookOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ExperimentPage from './pages/ExperimentPage';
import KnowledgePage from './pages/KnowledgePage';
import './App.css';

const { Header, Sider, Content } = Layout;

function App() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <ExperimentOutlined />,
      label: <Link to="/">实验台</Link>,
    },
    {
      key: '/knowledge',
      icon: <BookOutlined />,
      label: <Link to="/knowledge">知识库</Link>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} theme="dark">
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold'
        }}>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          一致性演练台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
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
          <h2 style={{ margin: 0 }}>分布式一致性演练台</h2>
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/experiment/:id" element={<ExperimentPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
