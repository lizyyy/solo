import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, message } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  BookOutlined,
  CreditCardOutlined,
  EnterOutlined,
  LogoutOutlined,
  DollarOutlined,
  ScheduleOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import Dashboard from './components/Dashboard';
import Persons from './components/Persons';
import PersonDetail from './components/PersonDetail';
import Trainings from './components/Trainings';
import Badges from './components/Badges';
import Entries from './components/Entries';
import Exits from './components/Exits';
import Settlements from './components/Settlements';
import Schedules from './components/Schedules';
import Export from './components/Export';
import axios from 'axios';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function App() {
  const [selectedKey, setSelectedKey] = useState('dashboard');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  const loadDashboard = async () => {
    try {
      const res = await axios.get('/api/dashboard');
      setDashboardData(res.data);
    } catch (err) {
      message.error('加载看板数据失败');
    }
  };

  useEffect(() => {
    if (selectedKey === 'dashboard') {
      loadDashboard();
    }
  }, [selectedKey]);

  const handleSelectPerson = (person) => {
    setSelectedPerson(person);
    setSelectedKey('personDetail');
  };

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '看板' },
    { key: 'persons', icon: <UserOutlined />, label: '人员管理' },
    { key: 'trainings', icon: <BookOutlined />, label: '培训记录' },
    { key: 'badges', icon: <CreditCardOutlined />, label: '工牌管理' },
    { key: 'entries', icon: <EnterOutlined />, label: '入场登记' },
    { key: 'exits', icon: <LogoutOutlined />, label: '离场登记' },
    { key: 'settlements', icon: <DollarOutlined />, label: '结算管理' },
    { key: 'schedules', icon: <ScheduleOutlined />, label: '排班管理' },
    { key: 'export', icon: <DownloadOutlined />, label: '数据导出' }
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case 'dashboard':
        return <Dashboard data={dashboardData} onSelectPerson={handleSelectPerson} />;
      case 'persons':
        return <Persons onSelectPerson={handleSelectPerson} />;
      case 'personDetail':
        return <PersonDetail person={selectedPerson} onBack={() => setSelectedKey('persons')} />;
      case 'trainings':
        return <Trainings />;
      case 'badges':
        return <Badges />;
      case 'entries':
        return <Entries />;
      case 'exits':
        return <Exits />;
      case 'settlements':
        return <Settlements />;
      case 'schedules':
        return <Schedules />;
      case 'export':
        return <Export projects={dashboardData?.projects || []} />;
      default:
        return <Dashboard data={dashboardData} />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
        <Title level={3} style={{ color: 'white', margin: 0, lineHeight: '64px' }}>
          人力外包入离场管理系统
        </Title>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
            onClick={({ key }) => setSelectedKey(key)}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8
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
