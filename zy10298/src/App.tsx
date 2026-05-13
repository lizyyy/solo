import { useState } from 'react';
import { Layout, Menu, theme, Typography, Space, Avatar } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { BoothApplication } from './types';
import StatsPanel from './components/StatsPanel';
import ApplicationList from './components/ApplicationList';
import ApplicationDetail from './components/ApplicationDetail';
import 'antd/dist/reset.css';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

function App() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const [selectedApp, setSelectedApp] = useState<BoothApplication | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleViewDetail = (app: BoothApplication) => {
    setSelectedApp(app);
    setDetailOpen(true);
  };

  const menuItems = [
    {
      key: '1',
      icon: <DashboardOutlined />,
      label: '展位管理',
    },
    {
      key: '2',
      icon: <ShoppingOutlined />,
      label: '品牌管理',
    },
    {
      key: '3',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={220}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <Title level={4} style={{ margin: 0 }}>🏪 商场展位管理</Title>
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={['1']}
          style={{ borderRight: 0 }}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <Title level={3} style={{ margin: 0 }}>展位工作台</Title>
          <Space>
            <span>管理员</span>
            <Avatar icon={<UserOutlined />} />
          </Space>
        </Header>
        <Content style={{ margin: '24px', overflow: 'auto' }}>
          <div style={{ padding: 24, minHeight: 360, background: colorBgContainer, borderRadius: borderRadiusLG }}>
            <StatsPanel />
            <div style={{ marginTop: 24 }}>
              <ApplicationList onViewDetail={handleViewDetail} />
            </div>
          </div>
        </Content>
      </Layout>
      <ApplicationDetail
        application={selectedApp}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </Layout>
  );
}

export default App;
