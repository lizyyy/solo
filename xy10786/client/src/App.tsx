import React, { useState } from 'react';
import { Layout, Menu, theme, Typography } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import Dashboard from './components/Dashboard';
import ContentList from './components/ContentList';
import CalendarView from './components/CalendarView';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

type MenuKey = 'dashboard' | 'content' | 'calendar';

const App: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState<MenuKey>('dashboard');
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard'
    },
    {
      key: 'content',
      icon: <FileTextOutlined />,
      label: 'Content Management'
    },
    {
      key: 'calendar',
      icon: <CalendarOutlined />,
      label: 'Publish Calendar'
    }
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case 'dashboard':
        return <Dashboard />;
      case 'content':
        return <ContentList />;
      case 'calendar':
        return <CalendarView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={250}>
        <div style={{ padding: '24px 16px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>
            Content Publishing Queue
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onSelect={({ key }) => setSelectedKey(key as MenuKey)}
          style={{ marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, borderBottom: '1px solid #f0f0f0' }} />
        <Content
          style={{
            margin: 0,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
