import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  ApiOutlined,
  PlusOutlined,
  ImportOutlined,
  ExportOutlined,
  StarOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import ApiList from './pages/ApiList';
import ApiDetail from './pages/ApiDetail';
import CreateApi from './pages/CreateApi';
import BulkImport from './pages/BulkImport';
import ExportReport from './pages/ExportReport';
import Favorites from './pages/Favorites';
import Owners from './pages/Owners';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/',
      icon: <ApiOutlined />,
      label: <Link to="/">API 目录</Link>,
    },
    {
      key: '/create',
      icon: <PlusOutlined />,
      label: <Link to="/create">新建 API</Link>,
    },
    {
      key: '/favorites',
      icon: <StarOutlined />,
      label: <Link to="/favorites">我的收藏</Link>,
    },
    {
      key: '/owners',
      icon: <TeamOutlined />,
      label: <Link to="/owners">负责人管理</Link>,
    },
    {
      key: '/import',
      icon: <ImportOutlined />,
      label: <Link to="/import">批量导入</Link>,
    },
    {
      key: '/export',
      icon: <ExportOutlined />,
      label: <Link to="/export">报告导出</Link>,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 'bold' }}>
          API 目录
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['/']}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, display: 'flex', alignItems: 'center', paddingLeft: 24 }}>
          <h2 style={{ margin: 0 }}>内部 API 目录站</h2>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Routes>
            <Route path="/" element={<ApiList />} />
            <Route path="/apis/:id" element={<ApiDetail />} />
            <Route path="/create" element={<CreateApi />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/owners" element={<Owners />} />
            <Route path="/import" element={<BulkImport />} />
            <Route path="/export" element={<ExportReport />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
