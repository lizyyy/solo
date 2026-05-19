import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  SupplierOutlined,
  ShoppingOutlined,
  BookOutlined,
  LinkOutlined,
  SyncOutlined,
  WarningOutlined,
  FileTextOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Suppliers from './pages/Suppliers';
import Products from './pages/Products';
import Catalog from './pages/Catalog';
import Mappings from './pages/Mappings';
import SyncBatches from './pages/SyncBatches';
import Conflicts from './pages/Conflicts';
import Reports from './pages/Reports';
import Compensation from './pages/Compensation';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { key: '1', icon: <SupplierOutlined />, label: <Link to="/suppliers">供应商管理</Link> },
    { key: '2', icon: <ShoppingOutlined />, label: <Link to="/products">供应商商品</Link> },
    { key: '3', icon: <BookOutlined />, label: <Link to="/catalog">内部目录</Link> },
    { key: '4', icon: <LinkOutlined />, label: <Link to="/mappings">映射管理</Link> },
    { key: '5', icon: <SyncOutlined />, label: <Link to="/sync">同步批次</Link> },
    { key: '6', icon: <WarningOutlined />, label: <Link to="/conflicts">冲突处理</Link> },
    { key: '7', icon: <ToolOutlined />, label: <Link to="/compensation">补偿机制</Link> },
    { key: '8', icon: <FileTextOutlined />, label: <Link to="/reports">报表导出</Link> },
  ];

  return (
    <BrowserRouter>
      <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 6 }} />
        <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline" items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <h1 style={{ marginLeft: 24, fontSize: 20 }}>供应商目录映射系统</h1>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Routes>
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/products" element={<Products />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/mappings" element={<Mappings />} />
            <Route path="/sync" element={<SyncBatches />} />
            <Route path="/conflicts" element={<Conflicts />} />
            <Route path="/compensation" element={<Compensation />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/" element={<Suppliers />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
    </BrowserRouter>
  );
};

export default App;
