import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, message } from 'antd';
import {
  PackageOutlined,
  ScheduleOutlined,
  CalendarOutlined,
  SwapOutlined,
  DollarOutlined,
  BookOutlined,
  FileTextOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import Packages from './components/Packages';
import Schedules from './components/Schedules';
import LeaveDeductions from './components/LeaveDeductions';
import Transfers from './components/Transfers';
import Refunds from './components/Refunds';
import Ledger from './components/Ledger';
import Logs from './components/Logs';
import Export from './components/Export';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function App() {
  const [selectedKey, setSelectedKey] = useState('packages');
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    fetch('/api/packages')
      .then(res => res.json())
      .then(data => setPackages(data))
      .catch(err => message.error('加载课包数据失败'));
  }, []);

  const menuItems = [
    { key: 'packages', icon: <PackageOutlined />, label: '会员课包' },
    { key: 'schedules', icon: <ScheduleOutlined />, label: '教练排班' },
    { key: 'leave', icon: <CalendarOutlined />, label: '请假扣课' },
    { key: 'transfers', icon: <SwapOutlined />, label: '转课分成' },
    { key: 'refunds', icon: <DollarOutlined />, label: '退款试算' },
    { key: 'ledger', icon: <BookOutlined />, label: '余额账本' },
    { key: 'logs', icon: <FileTextOutlined />, label: '操作日志' },
    { key: 'export', icon: <DownloadOutlined />, label: '数据导出' }
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case 'packages':
        return <Packages packages={packages} setPackages={setPackages} />;
      case 'schedules':
        return <Schedules packages={packages} />;
      case 'leave':
        return <LeaveDeductions packages={packages} />;
      case 'transfers':
        return <Transfers packages={packages} />;
      case 'refunds':
        return <Refunds packages={packages} />;
      case 'ledger':
        return <Ledger />;
      case 'logs':
        return <Logs />;
      case 'export':
        return <Export />;
      default:
        return <Packages packages={packages} setPackages={setPackages} />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', margin: 0, lineHeight: '64px' }}>
          私教课包消课退款管理系统
        </Title>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => setSelectedKey(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content style={{ background: '#fff', padding: 24, margin: 0, minHeight: 280 }}>
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
