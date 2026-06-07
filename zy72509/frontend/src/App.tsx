import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  TableOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import RecordList from './pages/RecordList';
import ConflictList from './pages/ConflictList';
import SelfCheckPage from './pages/SelfCheckPage';

const { Header, Content, Sider } = Layout;

type MenuKey = 'records' | 'conflicts' | 'selfcheck';

function App() {
  const [selectedKey, setSelectedKey] = useState<MenuKey>('records');
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    { key: 'records', icon: <TableOutlined />, label: '标注记录管理' },
    { key: 'conflicts', icon: <WarningOutlined />, label: '冲突处理中心' },
    { key: 'selfcheck', icon: <CheckCircleOutlined />, label: '自检中心' },
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case 'records':
        return <RecordList />;
      case 'conflicts':
        return <ConflictList />;
      case 'selfcheck':
        return <SelfCheckPage />;
      default:
        return <RecordList />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 'bold' }}>
          越权拦截系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => setSelectedKey(key as MenuKey)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ padding: '0 24px', fontSize: 18, fontWeight: 500 }}>
            {menuItems.find(m => m.key === selectedKey)?.label}
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG, minHeight: 360 }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
