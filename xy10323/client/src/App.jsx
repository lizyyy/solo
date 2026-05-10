import React from 'react';
import { Routes, Route, Layout } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  HomeOutlined,
  FileListOutlined,
  ExportOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import ApplicationList from './pages/ApplicationList.jsx';
import ApplicationDetail from './pages/ApplicationDetail.jsx';
import DataCorrectionGuide from './pages/DataCorrectionGuide.jsx';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const menuItems = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: <Link to="/">首页</Link>
  },
  {
    key: '/applications',
    icon: <FileListOutlined />,
    label: <Link to="/applications">申请管理</Link>
  },
  {
    key: '/correction-guide',
    icon: <QuestionCircleOutlined />,
    label: <Link to="/correction-guide">补录数据说明</Link>
  }
];

function App() {
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            background: '#fff', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            🏠
          </div>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            小区装修押金退还台
          </Title>
        </div>
      </Header>
      
      <Layout>
        <Sider width={200} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname === '/' ? '/' : location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              background: '#fff',
              padding: 24,
              margin: 0,
              minHeight: 280,
              borderRadius: '8px'
            }}
          >
            <Routes>
              <Route path="/" element={<ApplicationList />} />
              <Route path="/applications" element={<ApplicationList />} />
              <Route path="/applications/:id" element={<ApplicationDetail />} />
              <Route path="/correction-guide" element={<DataCorrectionGuide />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
