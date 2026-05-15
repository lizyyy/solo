import { useState, useEffect } from 'react';
import { Layout, Menu, theme, Card, Row, Col, Statistic } from 'antd';
import {
  FileTextOutlined,
  WarningOutlined,
  HistoryOutlined,
  BarChartOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import BatchList from './pages/BatchList';
import DiscrepancyQueue from './pages/DiscrepancyQueue';
import HistoryTrace from './pages/HistoryTrace';
import Dashboard from './pages/Dashboard';
import { statisticsApi } from './api';
import { BatchStatistics, DiscrepancyStatistics } from './types';

const { Header, Content, Sider } = Layout;

function App() {
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  
  const navigate = useNavigate();
  const location = useLocation();
  const [batchStats, setBatchStats] = useState<BatchStatistics | null>(null);
  const [discrepancyStats, setDiscrepancyStats] = useState<DiscrepancyStatistics | null>(null);

  const loadStatistics = async () => {
    try {
      const [batchRes, discRes] = await Promise.all([
        statisticsApi.batches(),
        statisticsApi.discrepancies(),
      ]);
      setBatchStats(batchRes.data);
      setDiscrepancyStats(discRes.data);
    } catch (error) {
      console.error('加载统计数据失败', error);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  const menuItems = [
    {
      key: '/',
      icon: <BarChartOutlined />,
      label: '数据概览',
    },
    {
      key: '/batches',
      icon: <FileTextOutlined />,
      label: '对账批次',
    },
    {
      key: '/discrepancies',
      icon: <WarningOutlined />,
      label: '异常队列',
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: '历史轨迹',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <PlayCircleOutlined style={{ color: '#fff', fontSize: '24px', marginRight: '12px' }} />
        <h1 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>支付对账接口台</h1>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: colorBgContainer }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: 8,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard batchStats={batchStats} discrepancyStats={discrepancyStats} onRefresh={loadStatistics} />} />
              <Route path="/batches" element={<BatchList onStatusChange={loadStatistics} />} />
              <Route path="/discrepancies" element={<DiscrepancyQueue onStatusChange={loadStatistics} />} />
              <Route path="/history" element={<HistoryTrace />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
