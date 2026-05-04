import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import { 
  FileAddOutlined, 
  UnorderedListOutlined, 
  WarningOutlined, 
  CheckCircleOutlined,
  ExportOutlined
} from '@ant-design/icons';
import ImportPage from './pages/ImportPage';
import ListPage from './pages/ListPage';
import RiskPage from './pages/RiskPage';
import ReviewPage from './pages/ReviewPage';
import ExportPage from './pages/ExportPage';
import { PhotoScanProvider } from './context/PhotoScanContext';

const { Header, Content, Sider } = Layout;

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('1');
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    { key: '1', icon: <FileAddOutlined />, label: '数据导入' },
    { key: '2', icon: <UnorderedListOutlined />, label: '记录列表' },
    { key: '3', icon: <WarningOutlined />, label: '风险检查' },
    { key: '4', icon: <CheckCircleOutlined />, label: '复核处理' },
    { key: '5', icon: <ExportOutlined />, label: '导出交付' },
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case '1':
        return <ImportPage />;
      case '2':
        return <ListPage />;
      case '3':
        return <RiskPage />;
      case '4':
        return <ReviewPage />;
      case '5':
        return <ExportPage />;
      default:
        return <ImportPage />;
    }
  };

  return (
    <PhotoScanProvider>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
          <div style={{ 
            height: 32, 
            margin: 16, 
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: collapsed ? 12 : 14
          }}>
            {collapsed ? '扫描' : '照片扫描管理'}
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => setSelectedKey(key)}
          />
        </Sider>
        <Layout>
          <Header style={{ padding: 0, background: colorBgContainer, display: 'flex', alignItems: 'center', paddingLeft: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>老照片底片扫描管理系统</h2>
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
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </PhotoScanProvider>
  );
}

export default App;
