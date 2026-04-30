import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, message } from 'antd';
import { 
  HomeOutlined, 
  DatabaseOutlined, 
  FileTextOutlined, 
  ImportOutlined,
  ExportOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Samples from './pages/Samples';
import BorrowRecords from './pages/BorrowRecords';
import ImportExport from './pages/ImportExport';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    message.config({
      top: 100,
      duration: 2,
      maxCount: 3,
    });
  }, []);

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">首页概览</Link>,
    },
    {
      key: '/samples',
      icon: <DatabaseOutlined />,
      label: <Link to="/samples">样品管理</Link>,
    },
    {
      key: '/borrow-records',
      icon: <FileTextOutlined />,
      label: <Link to="/borrow-records">借用记录</Link>,
    },
    {
      key: '/import-export',
      icon: <ImportOutlined />,
      label: <Link to="/import-export">导入导出</Link>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div className="logo" style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)' }}>
          {!collapsed && <span style={{ color: '#fff', padding: '8px', display: 'block', textAlign: 'center', fontWeight: 'bold' }}>样品借用台账</span>}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: '#fff' }} />
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: '#fff' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/samples" element={<Samples />} />
            <Route path="/borrow-records" element={<BorrowRecords />} />
            <Route path="/import-export" element={<ImportExport />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
