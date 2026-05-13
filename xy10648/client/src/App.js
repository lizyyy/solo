import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, Button, message } from 'antd';
import {
  DashboardOutlined,
  FundProjectionScreenOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  FileSearchOutlined,
  DollarOutlined,
  HistoryOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Budgets from './pages/Budgets';
import Activities from './pages/Activities';
import Purchases from './pages/Purchases';
import Invoices from './pages/Invoices';
import Payments from './pages/Payments';
import Logs from './pages/Logs';
import ReviewPanel from './pages/ReviewPanel';
import axios from 'axios';

const { Header, Content, Sider } = Layout;

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState('张三');

  const handleExport = () => {
    window.open('/api/logs/export', '_blank');
    message.success('导出成功！');
  };

  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
          <div style={{ height: 32, margin: 16, background: 'rgba(255,255,255,.2)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
            {collapsed ? '报销' : '社团经费报销系统'}
          </div>
          <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
            <Menu.Item key="1" icon={<DashboardOutlined />}>
              <Link to="/">仪表盘</Link>
            </Menu.Item>
            <Menu.Item key="2" icon={<FundProjectionScreenOutlined />}>
              <Link to="/budgets">预算管理</Link>
            </Menu.Item>
            <Menu.Item key="3" icon={<FundProjectionScreenOutlined />}>
              <Link to="/activities">活动申请</Link>
            </Menu.Item>
            <Menu.Item key="4" icon={<ShoppingCartOutlined />}>
              <Link to="/purchases">采购明细</Link>
            </Menu.Item>
            <Menu.Item key="5" icon={<FileTextOutlined />}>
              <Link to="/invoices">票据审核</Link>
            </Menu.Item>
            <Menu.Item key="6" icon={<DollarOutlined />}>
              <Link to="/payments">支付进度</Link>
            </Menu.Item>
            <Menu.Item key="7" icon={<FileSearchOutlined />}>
              <Link to="/review">复核面板</Link>
            </Menu.Item>
            <Menu.Item key="8" icon={<HistoryOutlined />}>
              <Link to="/logs">操作日志</Link>
            </Menu.Item>
          </Menu>
        </Sider>
        <Layout className="site-layout">
          <Header className="site-layout-background" style={{ padding: '0 16px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <span style={{ fontWeight: 'bold', fontSize: 18 }}>社团经费票据报销系统</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
                导出报表
              </Button>
              <span>当前用户: {currentUser}</span>
            </div>
          </Header>
          <Content style={{ margin: '16px' }}>
            <div style={{ padding: 24, minHeight: 360, background: '#fff', borderRadius: 4 }}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/activities" element={<Activities />} />
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/review" element={<ReviewPanel />} />
                <Route path="/logs" element={<Logs />} />
              </Routes>
            </div>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}

export default App;
