import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Space, Typography, Dropdown, theme } from 'antd';
import {
  HomeOutlined,
  ProjectOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '首页',
      onClick: () => navigate('/'),
    },
    {
      key: '/projects',
      icon: <ProjectOutlined />,
      label: '项目管理',
      onClick: () => navigate('/projects'),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>
            {collapsed ? 'PV' : '光伏模拟器'}
          </Title>
        </div>
        <Menu theme="dark" defaultSelectedKeys={['/']} mode="inline" items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>
            屋顶光伏排布和收益模拟工具
          </Title>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/projects')}
            >
              新建项目
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Routes>
            <Route path="/" element={<ProjectList />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
