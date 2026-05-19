import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, Typography } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import TaskList from './pages/TaskList';
import TaskDetail from './pages/TaskDetail';
import './App.css';

const { Header, Content } = Layout;
const { Title } = Typography;

function App() {
  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <DatabaseOutlined style={{ fontSize: '24px', color: '#fff' }} />
          <Title level={3} style={{ color: '#fff', margin: 0 }}>
            向量索引重建控制台
          </Title>
        </div>
      </Header>
      <Content className="app-content">
        <Routes>
          <Route path="/" element={<TaskList />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;