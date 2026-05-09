import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  MessageOutlined,
  HistoryOutlined,
  BarChartOutlined,
  FileTextOutlined,
  BugOutlined,
} from '@ant-design/icons';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import MessageList from './pages/MessageList';
import MessageDetail from './pages/MessageDetail';
import ReplayView from './pages/ReplayView';
import Reports from './pages/Reports';
import Diagnostics from './pages/Diagnostics';

const { Header, Sider, Content } = Layout;

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/messages',
      icon: <MessageOutlined />,
      label: '消息管理',
    },
    {
      key: '/replay',
      icon: <HistoryOutlined />,
      label: '操作回放',
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: '报告导出',
    },
    {
      key: '/diagnostics',
      icon: <BugOutlined />,
      label: '问题诊断',
    },
  ];

  const getSelectedKey = () => {
    if (location.pathname.startsWith('/messages/')) return '/messages';
    return location.pathname;
  };

  return (
    <Layout>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div className="logo">{collapsed ? 'LP' : 'Live Push'}</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{ padding: '0 24px', fontSize: '18px', fontWeight: 'bold' }}>
            直播推送系统 - 管理后台
          </div>
        </Header>
        <Content style={{ margin: '0 16px' }}>
          <div className="page-content">
            <Routes>
              <Route path="/" element={<MessageList />} />
              <Route path="/messages" element={<MessageList />} />
              <Route path="/messages/:messageId" element={<MessageDetail />} />
              <Route path="/replay" element={<ReplayView />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/diagnostics" element={<Diagnostics />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
