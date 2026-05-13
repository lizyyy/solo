import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, message } from 'antd';
import { DashboardOutlined, UserOutlined, FileTextOutlined, ExceptionOutlined, HistoryOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Dashboard from './pages/Dashboard';
import Children from './pages/Children';
import PickupRecords from './pages/PickupRecords';
import Exceptions from './pages/Exceptions';
import TempAuthorizations from './pages/TempAuthorizations';
import './index.css';

const { Header, Content } = Layout;

function App() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState('dashboard');

  useEffect(() => {
    const path = window.location.pathname.split('/')[1] || 'dashboard';
    setCurrent(path);
  }, []);

  const handleMenuClick = (e) => {
    setCurrent(e.key);
    navigate(`/${e.key}`);
  };

  const initDemoData = async () => {
    try {
      await axios.post('/api/demo/init');
      message.success('演示数据初始化成功！');
      window.location.reload();
    } catch (error) {
      message.error('初始化失败，请重试');
    }
  };

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '异常看板' },
    { key: 'children', icon: <UserOutlined />, label: '儿童档案' },
    { key: 'exceptions', icon: <ExceptionOutlined />, label: '异常记录' },
    { key: 'records', icon: <FileTextOutlined />, label: '接送记录' },
    { key: 'temp-auth', icon: <HistoryOutlined />, label: '临时授权' },
  ];

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="app-logo">托育接送管理系统</div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[current]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ flex: 1, minWidth: 0 }}
        />
      </Header>
      <Content className="app-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/children" element={<Children />} />
          <Route path="/exceptions" element={<Exceptions />} />
          <Route path="/records" element={<PickupRecords />} />
          <Route path="/temp-auth" element={<TempAuthorizations />} />
        </Routes>
      </Content>
      <Button
        type="primary"
        icon={<ReloadOutlined />}
        onClick={initDemoData}
        className="init-demo-btn"
      >
        初始化演示数据
      </Button>
    </Layout>
  );
}

export default App;
