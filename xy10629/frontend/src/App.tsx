import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  BoxPlotOutlined,
  RetweetOutlined,
  ClearOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  SendOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Packages from './pages/Packages';
import Recovery from './pages/Recovery';
import Cleaning from './pages/Cleaning';
import Sterilization from './pages/Sterilization';
import Isolation from './pages/Isolation';
import Distribution from './pages/Distribution';
import Report from './pages/Report';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState('dashboard');
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '数据概览' },
    { key: 'packages', icon: <BoxPlotOutlined />, label: '器械包管理' },
    { key: 'recovery', icon: <RetweetOutlined />, label: '回收登记' },
    { key: 'cleaning', icon: <ClearOutlined />, label: '清洗记录' },
    { key: 'sterilization', icon: <ThunderboltOutlined />, label: '灭菌批次' },
    { key: 'isolation', icon: <WarningOutlined />, label: '异常隔离' },
    { key: 'distribution', icon: <SendOutlined />, label: '科室发放' },
    { key: 'report', icon: <FileTextOutlined />, label: '报表导出' },
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case 'dashboard': return <Dashboard />;
      case 'packages': return <Packages />;
      case 'recovery': return <Recovery />;
      case 'cleaning': return <Cleaning />;
      case 'sterilization': return <Sterilization />;
      case 'isolation': return <Isolation />;
      case 'distribution': return <Distribution />;
      case 'report': return <Report />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      <Layout className="main-layout">
        <Sider theme="light" width={220}>
          <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
            <h2 style={{ margin: 0, fontSize: 16, color: '#1890ff' }}>消毒灭菌追溯系统</h2>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => setSelectedKey(key)}
            style={{ height: 'calc(100vh - 64px)', borderRight: 0 }}
          />
        </Sider>
        <Layout>
          <Header style={{ padding: 0, background: colorBgContainer, borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ paddingLeft: 24, fontSize: 18, fontWeight: 500 }}>
              {menuItems.find(item => item.key === selectedKey)?.label}
            </div>
          </Header>
          <Content style={{ margin: '24px 24px 0', overflow: 'initial' }}>
            <div
              style={{
                padding: 24,
                minHeight: 360,
                background: colorBgContainer,
                borderRadius: borderRadiusLG,
              }}
            >
              {renderContent()}
            </div>
          </Content>
        </Layout>
      </Layout>
    </div>
  );
};

export default App;
