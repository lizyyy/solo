import React, { useState, useEffect, useCallback } from 'react';
import { Layout, message, Spin, Empty } from 'antd';
import { Header } from 'antd/es/layout/layout';
import { suppliesApi, borrowRecordsApi, statsApi } from './services/api';
import SupplySidebar from './components/SupplySidebar';
import MainContent from './components/MainContent';
import './App.css';

const { Content } = Layout;

function App() {
  const [supplies, setSupplies] = useState([]);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('all');
  const [selectedSupplyId, setSelectedSupplyId] = useState(null);
  const [messageApi, contextHolder] = message.useMessage();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [suppliesData, statsData] = await Promise.all([
        suppliesApi.getAll(),
        statsApi.getOverview()
      ]);
      setSupplies(suppliesData);
      setStats(statsData);
    } catch (error) {
      messageApi.error(error.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  const fetchRecords = useCallback(async (view = 'all', supplyId = null) => {
    try {
      const params = {};
      if (view === 'overdue') params.view = 'overdue';
      else if (view === 'today') params.view = 'today';
      else if (view === 'active') params.view = 'active';
      
      if (supplyId) params.supplyId = supplyId;
      
      const data = await borrowRecordsApi.getAll(params);
      setRecords(data);
    } catch (error) {
      messageApi.error(error.message || '加载借用记录失败');
    }
  }, [messageApi]);

  useEffect(() => {
    fetchData();
    fetchRecords(currentView, selectedSupplyId);
  }, [fetchData, fetchRecords, currentView, selectedSupplyId]);

  const handleViewChange = (view) => {
    setCurrentView(view);
    setSelectedSupplyId(null);
  };

  const handleSupplySelect = (supplyId) => {
    setSelectedSupplyId(supplyId);
    setCurrentView('all');
  };

  const handleSupplyChange = () => {
    fetchData();
  };

  const handleRecordChange = () => {
    fetchRecords(currentView, selectedSupplyId);
    fetchData();
  };

  const getViewTitle = () => {
    if (selectedSupplyId) {
      const supply = supplies.find(s => s.id === selectedSupplyId);
      return supply ? `「${supply.name}」的借用记录` : '借用记录';
    }
    switch (currentView) {
      case 'overdue': return '逾期未还';
      case 'today': return '今日应还';
      case 'active': return '进行中';
      default: return '全部记录';
    }
  };

  if (loading) {
    return (
      <div className="app-loading">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="App">
      {contextHolder}
      <Layout className="app-layout">
        <Header className="app-header">
          <div className="header-content">
            <span className="app-title">📦 物资借还小台账</span>
          </div>
        </Header>
        <Layout className="main-layout">
          <SupplySidebar
            supplies={supplies}
            stats={stats}
            selectedSupplyId={selectedSupplyId}
            onSupplySelect={handleSupplySelect}
            onSupplyChange={handleSupplyChange}
            messageApi={messageApi}
          />
          <Content className="main-content">
            <MainContent
              records={records}
              supplies={supplies}
              currentView={currentView}
              viewTitle={getViewTitle()}
              onViewChange={handleViewChange}
              onRecordChange={handleRecordChange}
              messageApi={messageApi}
            />
          </Content>
        </Layout>
      </Layout>
    </div>
  );
}

export default App;
