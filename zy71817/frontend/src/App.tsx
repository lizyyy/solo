import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Button, Space, message } from 'antd';
import { ReloadOutlined, FileExcelOutlined, ExperimentOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import TransactionList from './components/TransactionList';
import ReconciliationSummary from './components/ReconciliationSummary';
import { sampleApi, exportApi } from './utils/api';

const { Header, Content } = Layout;

const App: React.FC = () => {
  const [currentPeriod, setCurrentPeriod] = useState(dayjs().format('YYYY-MM'));
  const [refreshKey, setRefreshKey] = useState(0);

  const handleGenerateSample = async () => {
    try {
      await sampleApi.generate(currentPeriod);
      message.success('示例数据生成成功！已包含正常记录、重复项、跨期手续费、退款挂账等场景');
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      message.error('生成示例数据失败');
    }
  };

  const handleExport = (type: 'all' | 'anomalies' | 'reconciliation') => {
    exportApi.download(currentPeriod, type);
    message.success('正在导出，请稍候...');
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>售后赔付分摊系统</h2>
          <Space>
            <Button icon={<ExperimentOutlined />} onClick={handleGenerateSample}>
              生成示例数据
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={() => handleExport('reconciliation')}>
              导出对账说明
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={() => handleExport('anomalies')}>
              导出异常记录
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={() => handleExport('all')}>
              导出完整数据
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
          </Space>
        </div>
      </Header>
      <Content style={{ padding: '24px' }}>
        <Tabs
          items={[
            {
              key: '1',
              label: '对账汇总',
              children: (
                <ReconciliationSummary
                  period={currentPeriod}
                  refreshKey={refreshKey}
                  onPeriodChange={setCurrentPeriod}
                />
              )
            },
            {
              key: '2',
              label: '流水管理',
              children: (
                <TransactionList
                  period={currentPeriod}
                  refreshKey={refreshKey}
                />
              )
            }
          ]}
        />
      </Content>
    </Layout>
  );
};

export default App;
