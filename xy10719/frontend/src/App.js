import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  DatabaseOutlined,
  SafetyOutlined,
  FileCheckOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import SampleList from './pages/SampleList';
import SampleDetail from './pages/SampleDetail';
import MaskingPreview from './pages/MaskingPreview';
import ComplianceRecords from './pages/ComplianceRecords';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const menuItems = [
    {
      key: '1',
      icon: <DatabaseOutlined />,
      label: <Link to="/">样例数据管理</Link>,
    },
    {
      key: '2',
      icon: <SafetyOutlined />,
      label: <Link to="/masking">脱敏策略预览</Link>,
    },
    {
      key: '3',
      icon: <FileCheckOutlined />,
      label: <Link to="/compliance">合规记录</Link>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={200}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 'bold' }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          脱敏试验台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['1']}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, borderBottom: '1px solid #e8e8e8' }}>
          <div style={{ paddingLeft: 24, fontSize: 18, fontWeight: 500 }}>
            数据脱敏规则试验台
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, borderRadius: 8 }}>
          <Routes>
            <Route path="/" element={<SampleList />} />
            <Route path="/sample/:id" element={<SampleDetail />} />
            <Route path="/masking" element={<MaskingPreview />} />
            <Route path="/compliance" element={<ComplianceRecords />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
