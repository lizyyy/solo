import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DatabaseOutlined,
  AlertOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import SampleList from './pages/SampleList';
import AnomalyDashboard from './pages/AnomalyDashboard';
import ExportReport from './pages/ExportReport';

const { Header, Content, Sider } = Layout;

function App() {
  const menuItems = [
    {
      key: '/',
      icon: <DatabaseOutlined />,
      label: <Link to="/">样品列表</Link>
    },
    {
      key: '/anomalies',
      icon: <AlertOutlined />,
      label: <Link to="/anomalies">异常看板</Link>
    },
    {
      key: '/export',
      icon: <FileExcelOutlined />,
      label: <Link to="/export">导出报告</Link>
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ padding: 0, background: '#001529' }}>
        <div style={{ color: 'white', fontSize: '20px', padding: '0 24px', lineHeight: '64px' }}>
          水质采样送检管理系统
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['/']}
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
              background: '#fff',
              borderRadius: 8
            }}
          >
            <Routes>
              <Route path="/" element={<SampleList />} />
              <Route path="/anomalies" element={<AnomalyDashboard />} />
              <Route path="/export" element={<ExportReport />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
