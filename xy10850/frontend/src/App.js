import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  ApiOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  LineChartOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import EndpointList from './pages/EndpointList';
import EndpointDetail from './pages/EndpointDetail';
import UpstreamList from './pages/UpstreamList';
import PageModuleList from './pages/PageModuleList';

const { Header, Content, Sider } = Layout;

const App = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider collapsible>
          <div style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
          }}>
            BFF 编排器
          </div>
          <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
            <Menu.Item key="1" icon={<ApiOutlined />}>
              <Link to="/endpoints">BFF 端点</Link>
            </Menu.Item>
            <Menu.Item key="2" icon={<CloudServerOutlined />}>
              <Link to="/upstreams">上游接口</Link>
            </Menu.Item>
            <Menu.Item key="3" icon={<FileTextOutlined />}>
              <Link to="/page-modules">页面模块</Link>
            </Menu.Item>
          </Menu>
        </Sider>
        <Layout>
          <Header style={{
            padding: 0,
            background: colorBgContainer,
            borderBottom: '1px solid #f0f0f0',
          }}>
            <div style={{ padding: '0 24px', fontSize: 16, fontWeight: 500 }}>
              BFF Endpoint Orchestrator
            </div>
          </Header>
          <Content style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}>
            <Routes>
              <Route path="/" element={<EndpointList />} />
              <Route path="/endpoints" element={<EndpointList />} />
              <Route path="/endpoints/:id" element={<EndpointDetail />} />
              <Route path="/upstreams" element={<UpstreamList />} />
              <Route path="/page-modules" element={<PageModuleList />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
};

export default App;
