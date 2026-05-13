import React from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Layout, Menu, theme, Typography, Space, Button } from 'antd';
import {
  DashboardOutlined,
  SwapOutlined,
  ToolOutlined,
  BoxOutlined,
  FileSearchOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import PlansPage from './pages/PlansPage';
import MoldPage from './pages/MoldPage';
import MaterialPage from './pages/MaterialPage';
import FirstArticlePage from './pages/FirstArticlePage';
import QualificationsPage from './pages/QualificationsPage';
import MissingItemsPage from './pages/MissingItemsPage';
import ExportModal from './components/ExportModal';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  return (
    <BrowserRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#001529' }}>
          <Space style={{ flex: 1 }}>
            <Title level={3} style={{ color: 'white', margin: 0, lineHeight: '64px' }}>
              制造换线准备齐套系统
            </Title>
          </Space>
          <ExportModal />
        </Header>
        <Layout>
          <Sider width={200} style={{ background: colorBgContainer }}>
            <Menu
              mode="inline"
              defaultSelectedKeys={['1']}
              defaultOpenKeys={['sub1']}
              style={{ height: '100%', borderRight: 0 }}
              items={[
                {
                  key: '1',
                  icon: <DashboardOutlined />,
                  label: <Link to="/">数据概览</Link>,
                },
                {
                  key: '2',
                  icon: <SwapOutlined />,
                  label: <Link to="/plans">换线计划</Link>,
                },
                {
                  key: '3',
                  icon: <ToolOutlined />,
                  label: <Link to="/mold">模具点检</Link>,
                },
                {
                  key: '4',
                  icon: <BoxOutlined />,
                  label: <Link to="/material">物料齐套</Link>,
                },
                {
                  key: '5',
                  icon: <FileSearchOutlined />,
                  label: <Link to="/first-article">首件检验</Link>,
                },
                {
                  key: '6',
                  icon: <UserOutlined />,
                  label: <Link to="/qualifications">人员资质</Link>,
                },
                {
                  key: '7',
                  icon: <ExclamationCircleOutlined />,
                  label: <Link to="/missing-items">缺项清单</Link>,
                },
              ]}
            />
          </Sider>
          <Layout style={{ padding: '24px' }}>
            <Content
              style={{
                padding: 24,
                margin: 0,
                minHeight: 280,
                background: colorBgContainer,
                borderRadius: 8,
              }}
            >
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/plans" element={<PlansPage />} />
                <Route path="/mold" element={<MoldPage />} />
                <Route path="/material" element={<MaterialPage />} />
                <Route path="/first-article" element={<FirstArticlePage />} />
                <Route path="/qualifications" element={<QualificationsPage />} />
                <Route path="/missing-items" element={<MissingItemsPage />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
