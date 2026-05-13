import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Tabs, message } from 'antd';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  GiftOutlined,
  SplitCellsOutlined,
  RefundOutlined,
  BarChartOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import StatsCard from './components/StatsCard';
import OrdersList from './components/OrdersList';
import ActivitiesList from './components/ActivitiesList';
import InventoryList from './components/InventoryList';
import SplitOrdersList from './components/SplitOrdersList';
import RefundsList from './components/RefundsList';
import ManualGiftsList from './components/ManualGiftsList';
import RecalculationsList from './components/RecalculationsList';
import ExportReport from './components/ExportReport';
import api from './api';
const { Header, Content, Sider } = Layout;
const { Title } = Typography;
function App() {
  const [activeTab, setActiveTab] = useState('orders');
  const [stats, setStats] = useState({});
  useEffect(() => {
    loadStats();
  }, []);
  const loadStats = async () => {
    try {
      const response = await api.get('/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      message.error('加载统计数据失败');
    }
  };
  const menuItems = [
    { key: 'orders', icon: <ShoppingCartOutlined />, label: '订单管理' },
    { key: 'activities', icon: <GiftOutlined />, label: '活动管理' },
    { key: 'inventory', icon: <BarChartOutlined />, label: '赠品库存' },
    { key: 'split-orders', icon: <SplitCellsOutlined />, label: '拆单记录' },
    { key: 'refunds', icon: <RefundOutlined />, label: '退款记录' },
    { key: 'manual-gifts', icon: <GiftOutlined />, label: '人工补赠' },
    { key: 'recalculations', icon: <BarChartOutlined />, label: '资格重算' },
    { key: 'export', icon: <FileExcelOutlined />, label: '报表导出' },
  ];
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <GiftOutlined style={{ color: '#fff', fontSize: '24px', marginRight: '12px' }} />
          <Title level={3} style={{ color: '#fff', margin: 0, lineHeight: '64px' }}>
            电商赠品拆单退款系统
          </Title>
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeTab]}
            items={menuItems}
            onClick={({ key }) => setActiveTab(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <StatsCard stats={stats} />
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: '8px'
            }}
          >
            <Tabs activeKey={activeTab} onChange={setActiveTab} items={menuItems} tabBarStyle={{ display: 'none' }}>
              <Tabs.TabPane tab="订单管理" key="orders">
                <OrdersList onRefresh={loadStats} />
              </Tabs.TabPane>
              <Tabs.TabPane tab="活动管理" key="activities">
                <ActivitiesList onRefresh={loadStats} />
              </Tabs.TabPane>
              <Tabs.TabPane tab="赠品库存" key="inventory">
                <InventoryList onRefresh={loadStats} />
              </Tabs.TabPane>
              <Tabs.TabPane tab="拆单记录" key="split-orders">
                <SplitOrdersList onRefresh={loadStats} />
              </Tabs.TabPane>
              <Tabs.TabPane tab="退款记录" key="refunds">
                <RefundsList onRefresh={loadStats} />
              </Tabs.TabPane>
              <Tabs.TabPane tab="人工补赠" key="manual-gifts">
                <ManualGiftsList onRefresh={loadStats} />
              </Tabs.TabPane>
              <Tabs.TabPane tab="资格重算" key="recalculations">
                <RecalculationsList onRefresh={loadStats} />
              </Tabs.TabPane>
              <Tabs.TabPane tab="报表导出" key="export">
                <ExportReport />
              </Tabs.TabPane>
            </Tabs>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
export default App;
