import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import { UnorderedListOutlined, PlusOutlined } from '@ant-design/icons';
import TicketList from './pages/TicketList';
import TicketDetail from './pages/TicketDetail';
import TicketForm from './pages/TicketForm';

const { Header, Sider, Content } = Layout;

const App: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', lineHeight: '32px', color: 'white', fontWeight: 'bold' }}>
          客服工单台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['1']}
          items={[
            {
              key: '1',
              icon: <UnorderedListOutlined />,
              label: <Link to="/">工单列表</Link>,
            },
            {
              key: '2',
              icon: <PlusOutlined />,
              label: <Link to="/create">新建工单</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <h1 style={{ margin: '0 24px', fontSize: '18px' }}>小团队客服工单台</h1>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Routes>
            <Route path="/" element={<TicketList />} />
            <Route path="/ticket/:id" element={<TicketDetail />} />
            <Route path="/create" element={<TicketForm />} />
            <Route path="/edit/:id" element={<TicketForm />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
