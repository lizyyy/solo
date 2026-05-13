import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import { 
  HomeOutlined, 
  TagsOutlined, 
  UndoOutlined, 
  ShopOutlined, 
  WarningOutlined, 
  FileTextOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import LinenList from './pages/LinenList';
import LinenDetail from './pages/LinenDetail';
import HandoverPage from './pages/HandoverPage';
import FactoryPage from './pages/FactoryPage';
import DamagePage from './pages/DamagePage';
import ReportPage from './pages/ReportPage';
import StatisticsPage from './pages/StatisticsPage';

const { Header, Content, Sider } = Layout;

function App() {
  const [selectedKey, setSelectedKey] = useState('1');
  const [selectedLinen, setSelectedLinen] = useState(null);

  const menuItems = [
    { key: '1', icon: <HomeOutlined />, label: '布草列表' },
    { key: '2', icon: <UndoOutlined />, label: '楼层交接' },
    { key: '3', icon: <ShopOutlined />, label: '洗涤厂收发' },
    { key: '4', icon: <WarningOutlined />, label: '破损管理' },
    { key: '5', icon: <FileTextOutlined />, label: '报告导出' },
    { key: '6', icon: <BarChartOutlined />, label: '统计概览' },
  ];

  const handleMenuClick = ({ key }) => {
    setSelectedKey(key);
    setSelectedLinen(null);
  };

  const handleViewDetail = (linen) => {
    setSelectedLinen(linen);
  };

  const handleBack = () => {
    setSelectedLinen(null);
  };

  const renderContent = () => {
    if (selectedLinen) {
      return <LinenDetail linen={selectedLinen} onBack={handleBack} />;
    }

    switch (selectedKey) {
      case '1':
        return <LinenList onViewDetail={handleViewDetail} />;
      case '2':
        return <HandoverPage />;
      case '3':
        return <FactoryPage />;
      case '4':
        return <DamagePage />;
      case '5':
        return <ReportPage />;
      case '6':
        return <StatisticsPage />;
      default:
        return <LinenList onViewDetail={handleViewDetail} />;
    }
  };

  return (
    <Layout className="app-container">
      <Header className="app-header">
        <h1>🏨 酒店布草洗涤追踪系统</h1>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            onClick={handleMenuClick}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: '0 24px 24px' }}>
          <Content className="app-content">
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;