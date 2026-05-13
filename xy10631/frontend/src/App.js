import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, message } from 'antd';
import { 
  DatabaseOutlined, 
  ShoppingCartOutlined, 
  HomeOutlined, 
  RollbackOutlined, 
  BellOutlined, 
  BarChartOutlined, 
  FileTextOutlined 
} from '@ant-design/icons';
import SkuList from './components/SkuList';
import ShiftUsageList from './components/ShiftUsageList';
import AreaList from './components/AreaList';
import ReturnInspectionList from './components/ReturnInspectionList';
import ReplenishmentAlertList from './components/ReplenishmentAlertList';
import CostVarianceList from './components/CostVarianceList';
import ReportPage from './components/ReportPage';
import api from './services/api';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function App() {
  const [activeKey, setActiveKey] = useState('1');
  const [hasSampleData, setHasSampleData] = useState(false);

  useEffect(() => {
    checkSampleData();
  }, []);

  const checkSampleData = async () => {
    try {
      const response = await api.get('/sku');
      if (response.data && response.data.length > 0) {
        setHasSampleData(true);
      }
    } catch (error) {
      console.error('检查数据失败:', error);
    }
  };

  const createSampleData = async () => {
    try {
      await api.get('/report/sample-data/create');
      message.success('样例数据创建成功！');
      setHasSampleData(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      message.error('创建样例数据失败');
    }
  };

  const menuItems = [
    { key: '1', icon: <DatabaseOutlined />, label: '耗材SKU管理' },
    { key: '2', icon: <ShoppingCartOutlined />, label: '班次领用管理' },
    { key: '3', icon: <HomeOutlined />, label: '区域管理' },
    { key: '4', icon: <RollbackOutlined />, label: '退回验收' },
    { key: '5', icon: <BellOutlined />, label: '补货预警' },
    { key: '6', icon: <BarChartOutlined />, label: '成本差异分析' },
    { key: '7', icon: <FileTextOutlined />, label: '责任节点报告' },
  ];

  const renderContent = () => {
    switch (activeKey) {
      case '1':
        return <SkuList />;
      case '2':
        return <ShiftUsageList />;
      case '3':
        return <AreaList />;
      case '4':
        return <ReturnInspectionList />;
      case '5':
        return <ReplenishmentAlertList />;
      case '6':
        return <CostVarianceList />;
      case '7':
        return <ReportPage />;
      default:
        return <SkuList />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          保洁耗材区域核算系统
        </Title>
        {!hasSampleData && (
          <button 
            onClick={createSampleData}
            style={{
              background: '#1890ff',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            创建样例数据
          </button>
        )}
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
            onClick={({ key }) => setActiveKey(key)}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: '8px'
            }}
          >
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;