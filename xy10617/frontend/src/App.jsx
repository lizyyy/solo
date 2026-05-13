import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  UserOutlined,
  BookOutlined,
  ShoppingOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import Consignors from './pages/Consignors';
import Books from './pages/Books';
import BookDetail from './pages/BookDetail';
import Sales from './pages/Sales';
import Settlements from './pages/Settlements';

const { Header, Content, Sider } = Layout;

function App() {
  const {
    token: { colorBgContainer }
  } = theme.useToken();

  const location = useLocation();

  const menuItems = [
    {
      key: '/consignors',
      icon: <UserOutlined />,
      label: <Link to="/consignors">寄售人管理</Link>
    },
    {
      key: '/books',
      icon: <BookOutlined />,
      label: <Link to="/books">书籍管理</Link>
    },
    {
      key: '/sales',
      icon: <ShoppingOutlined />,
      label: <Link to="/sales">销售记录</Link>
    },
    {
      key: '/settlements',
      icon: <FileTextOutlined />,
      label: <Link to="/settlements">结算管理</Link>
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
          二手书寄售结算系统
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: colorBgContainer }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: 8
            }}
          >
            <Routes>
              <Route path="/" element={<Consignors />} />
              <Route path="/consignors" element={<Consignors />} />
              <Route path="/books" element={<Books />} />
              <Route path="/books/:id" element={<BookDetail />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/settlements" element={<Settlements />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
