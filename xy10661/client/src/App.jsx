import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import PackageList from './pages/PackageList';
import PackageDetail from './pages/PackageDetail';
import ReportPage from './pages/ReportPage';

const { Header, Content } = Layout;

function App() {
  const menuItems = [
    { key: '1', label: <Link to="/">包裹列表</Link> },
    { key: '2', label: <Link to="/reports">报告导出</Link> }
  ];

  return (
    <Layout className="layout">
      <Header className="header">
        <div className="logo">无人仓分拣异常复核系统</div>
        <Menu theme="dark" mode="horizontal" items={menuItems} />
      </Header>
      <Content className="content">
        <Routes>
          <Route path="/" element={<PackageList />} />
          <Route path="/package/:id" element={<PackageDetail />} />
          <Route path="/reports" element={<ReportPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;
