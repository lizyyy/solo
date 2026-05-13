import React, { useState, useEffect } from 'react';
import { Layout, Menu, ConfigProvider, theme } from 'antd';
import { 
  FileTextOutlined, 
  UserOutlined, 
  ExclamationCircleOutlined, 
  BarChartOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import Statistics from './components/Statistics';
import ComplaintList from './components/ComplaintList';
import ComplaintDetail from './components/ComplaintDetail';
import AppealsList from './components/AppealsList';
import Reports from './components/Reports';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  const [selectedKey, setSelectedKey] = useState('1');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const handleSelectComplaint = (complaint) => {
    setSelectedComplaint(complaint);
    setShowDetail(true);
  };

  const handleBack = () => {
    setShowDetail(false);
    setSelectedComplaint(null);
  };

  const menuItems = [
    { key: '1', icon: <BarChartOutlined />, label: '统计概览' },
    { key: '2', icon: <ExclamationCircleOutlined />, label: '投诉管理' },
    { key: '3', icon: <HistoryOutlined />, label: '申诉管理' },
    { key: '4', icon: <FileTextOutlined />, label: '报表导出' },
  ];

  const renderContent = () => {
    if (showDetail && selectedComplaint) {
      return <ComplaintDetail complaintId={selectedComplaint.id} onBack={handleBack} />;
    }

    switch (selectedKey) {
      case '1':
        return <Statistics />;
      case '2':
        return <ComplaintList onSelectComplaint={handleSelectComplaint} />;
      case '3':
        return <AppealsList />;
      case '4':
        return <Reports />;
      default:
        return <Statistics />;
    }
  };

  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', background: '#001529', padding: '0 24px' }}>
          <ExclamationCircleOutlined style={{ color: '#fff', fontSize: '24px', marginRight: '12px' }} />
          <h1 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>内容侵权投诉申诉系统</h1>
        </Header>
        <Layout>
          <Sider width={200} style={{ background: '#fff' }}>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              style={{ height: '100%', borderRight: 0 }}
              items={menuItems}
              onClick={({ key }) => setSelectedKey(key)}
            />
          </Sider>
          <Layout style={{ padding: '24px' }}>
            <Content
              style={{
                padding: 24,
                margin: 0,
                minHeight: 280,
                background: '#fff',
                borderRadius: '8px',
              }}
            >
              {renderContent()}
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
