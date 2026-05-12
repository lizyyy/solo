import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, message } from 'antd';
import { 
  ShoppingOutlined, 
  GiftOutlined, 
  BarChartOutlined, 
  DatabaseOutlined 
} from '@ant-design/icons';
import OrderList from './pages/OrderList';
import ActivityList from './pages/ActivityList';
import InventoryLogs from './pages/InventoryLogs';
import Statistics from './pages/Statistics';
import api from './utils/api';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function App() {
  const [current, setCurrent] = useState('orders');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await api.get('/activities');
      if (res.data.success) {
        setActivities(res.data.data);
      }
    } catch (error) {
      message.error('加载活动列表失败');
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { key: 'orders', icon: <ShoppingOutlined />, label: '订单管理' },
    { key: 'activities', icon: <GiftOutlined />, label: '活动商品' },
    { key: 'inventory', icon: <DatabaseOutlined />, label: '库存变动日志' },
    { key: 'statistics', icon: <BarChartOutlined />, label: '数据统计' },
  ];

  const renderContent = () => {
    switch (current) {
      case 'orders':
        return <OrderList activities={activities} />;
      case 'activities':
        return <ActivityList activities={activities} onRefresh={fetchActivities} />;
      case 'inventory':
        return <InventoryLogs />;
      case 'statistics':
        return <Statistics activities={activities} />;
      default:
        return null;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
        <Title level={3} style={{ color: '#fff', margin: 0, lineHeight: '64px' }}>
          社群秒杀补单平台
        </Title>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[current]}
            items={menuItems}
            onClick={({ key }) => setCurrent(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8,
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
