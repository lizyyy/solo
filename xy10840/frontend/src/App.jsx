import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  FileTextOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import TemplateList from './pages/TemplateList';
import TemplateDetail from './pages/TemplateDetail';

const { Header, Content, Sider } = Layout;

function App() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: '1',
      icon: <FileTextOutlined />,
      label: '模板管理',
      onClick: () => window.location.href = '/',
    },
  ];

  return (
    <Router>
      <Layout className="app-container">
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#001529',
            padding: '0 24px',
          }}
        >
          <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
            <AppstoreOutlined style={{ marginRight: '12px' }} />
            提示词模板审批台
          </div>
        </Header>
        <Layout>
          <Sider
            width={200}
            style={{
              background: colorBgContainer,
            }}
            collapsible
            collapsed={collapsed}
            onCollapse={(value) => setCollapsed(value)}
          >
            <Menu
              mode="inline"
              defaultSelectedKeys={['1']}
              style={{
                height: '100%',
                borderRight: 0,
              }}
              items={menuItems}
            />
          </Sider>
          <Layout style={{ padding: '0 24px 24px' }}>
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
                <Route path="/" element={<TemplateList />} />
                <Route path="/template/:id" element={<TemplateDetail />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </Router>
  );
}

export default App;
