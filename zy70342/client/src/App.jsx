import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Layout, Typography, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import BatchList from './pages/BatchList';
import BatchDetail from './pages/BatchDetail';

const { Header, Content } = Layout;
const { Title } = Typography;

function App() {
  const navigate = useNavigate();

  return (
    <Layout className="app-container">
      <Header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Routes>
            <Route
              path="/batches/:id"
              element={
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate('/batches')}
                >
                  返回列表
                </Button>
              }
            />
            <Route path="*" element={null} />
          </Routes>
          <Title level={4} className="title" style={{ margin: 0 }}>
            多阶段导入校验台
          </Title>
        </div>
      </Header>
      <Content className="app-content">
        <Routes>
          <Route path="/" element={<BatchList />} />
          <Route path="/batches" element={<BatchList />} />
          <Route path="/batches/:id" element={<BatchDetail />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;
