import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, theme } from 'antd';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import BatchDetail from './pages/BatchDetail';
import Environments from './pages/Environments';
import './App.css';

const { Header, Content } = Layout;

function App() {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ padding: '0 24px', fontSize: '18px', fontWeight: 'bold' }}>
            API冒烟巡检面板
          </div>
        </Header>
        <Content style={{ margin: '24px', background: colorBgContainer, borderRadius: 8, padding: 24 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/collections/:id" element={<CollectionDetail />} />
            <Route path="/batches/:id" element={<BatchDetail />} />
            <Route path="/environments" element={<Environments />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
