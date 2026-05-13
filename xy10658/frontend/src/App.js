import React, { useState, useEffect } from 'react';
import { Layout, Menu, message, Button, Space } from 'antd';
import {
  HomeOutlined,
  ReloadOutlined,
  WalletOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import LeaseList from './components/LeaseList';
import RenewalList from './components/RenewalList';
import DepositList from './components/DepositList';
import MaintenanceList from './components/MaintenanceList';
import CheckoutList from './components/CheckoutList';
import PendingList from './components/PendingList';
import OperationLogs from './components/OperationLogs';
import ExportPanel from './components/ExportPanel';
import api from './services/api';

const { Header, Content, Sider } = Layout;

function App() {
  const [selectedKey, setSelectedKey] = useState('1');
  const [loading, setLoading] = useState(false);

  const menuItems = [
    { key: '1', icon: <HomeOutlined />, label: '房源合同' },
    { key: '2', icon: <ReloadOutlined />, label: '续租报价' },
    { key: '3', icon: <WalletOutlined />, label: '押金账本' },
    { key: '4', icon: <ToolOutlined />, label: '维修扣款' },
    { key: '5', icon: <CheckCircleOutlined />, label: '退租验收' },
    { key: '6', icon: <ClockCircleOutlined />, label: '待确认合同' },
    { key: '7', icon: <FileTextOutlined />, label: '操作日志' },
    { key: '8', icon: <DownloadOutlined />, label: '导出报表' }
  ];

  const generateSampleData = async () => {
    setLoading(true);
    try {
      await api.post('/sample/generate');
      message.success('样例数据生成成功！');
      setSelectedKey('1');
    } catch (error) {
      message.error('生成样例数据失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (selectedKey) {
      case '1': return <LeaseList />;
      case '2': return <RenewalList />;
      case '3': return <DepositList />;
      case '4': return <MaintenanceList />;
      case '5': return <CheckoutList />;
      case '6': return <PendingList />;
      case '7': return <OperationLogs />;
      case '8': return <ExportPanel />;
      default: return <LeaseList />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} style={{ background: '#fff' }}>
        <div style={{ height: 64, background: '#001529', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
          公寓租约管理
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => setSelectedKey(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>
            {menuItems.find(item => item.key === selectedKey)?.label}
          </span>
          <Space>
            <Button type="primary" onClick={generateSampleData} loading={loading}>
              生成样例数据
            </Button>
          </Space>
        </Header>
        <Content style={{ margin: '24px', background: '#fff', padding: 24, borderRadius: 8 }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
