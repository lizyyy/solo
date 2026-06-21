import { useState, useMemo } from 'react';
import { Layout, Tabs, Button, Space, App as AntdApp } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { mockLabRecords } from './data/mockData';
import { LabRecord, RecordStatus } from './types';
import { buildAnomalies } from './utils/cleaningLogic';
import { exportCommunicationList, updateRecordStatus } from './utils/export';
import OverviewPage from './pages/OverviewPage';
import AnomalyQueuePage from './pages/AnomalyQueuePage';

const { Header, Content } = Layout;

export default function App() {
  const { message } = AntdApp.useApp();
  const [records, setRecords] = useState<LabRecord[]>(mockLabRecords);
  const [activeTab, setActiveTab] = useState<string>('overview');

  const anomalies = useMemo(() => buildAnomalies(records), [records]);

  const handleStatusChange = (recordId: string, status: RecordStatus) => {
    setRecords((prev) => updateRecordStatus(prev, recordId, status));
    message.success(`已将记录状态更新为「${status === 'confirmed' ? '已确认' : status === 'pending' ? '待补件' : '退回'}」`);
  };

  const handleReset = () => {
    setRecords(mockLabRecords);
    message.info('已重置为内置示例数据');
  };

  const handleExport = () => {
    exportCommunicationList(records);
    message.success('异常沟通清单已导出');
  };

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="app-title">海洋牧场数据清洗工具</div>
          <span className="app-subtitle">实验室结果表 · 异常队列 · 沟通清单</span>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置示例数据
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出沟通清单
          </Button>
        </Space>
      </Header>
      <Content className="app-content">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: '数据总览',
              children: (
                <OverviewPage
                  records={records}
                  anomalies={anomalies}
                  onStatusChange={handleStatusChange}
                />
              )
            },
            {
              key: 'queue',
              label: `异常队列 (${anomalies.length})`,
              children: (
                <AnomalyQueuePage
                  records={records}
                  anomalies={anomalies}
                  onStatusChange={handleStatusChange}
                />
              )
            }
          ]}
        />
      </Content>
    </Layout>
  );
}
