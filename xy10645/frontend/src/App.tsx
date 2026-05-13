import React, { useState, useEffect } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
  RedoOutlined,
  SafetyCertificateOutlined,
  HistoryOutlined,
  BarChartOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import StatisticsDashboard from './components/StatisticsDashboard';
import StudentsPage from './components/StudentsPage';
import AttendancePage from './components/AttendancePage';
import ExamScoresPage from './components/ExamScoresPage';
import RetakeRecordsPage from './components/RetakeRecordsPage';
import CertificatesPage from './components/CertificatesPage';
import HistoryPage from './components/HistoryPage';
import ExportPage from './components/ExportPage';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('statistics');
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken();

  const menuItems = [
    { key: 'statistics', label: '统计概览', icon: <BarChartOutlined /> },
    { key: 'students', label: '学员管理', icon: <UserOutlined /> },
    { key: 'attendance', label: '出勤记录', icon: <CalendarOutlined /> },
    { key: 'exam-scores', label: '考试成绩', icon: <FileTextOutlined /> },
    { key: 'retake-records', label: '补考记录', icon: <RedoOutlined /> },
    { key: 'certificates', label: '证书发放', icon: <SafetyCertificateOutlined /> },
    { key: 'history', label: '变更历史', icon: <HistoryOutlined /> },
    { key: 'export', label: '数据导出', icon: <DownloadOutlined /> }
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case 'statistics':
        return <StatisticsDashboard />;
      case 'students':
        return <StudentsPage />;
      case 'attendance':
        return <AttendancePage />;
      case 'exam-scores':
        return <ExamScoresPage />;
      case 'retake-records':
        return <RetakeRecordsPage />;
      case 'certificates':
        return <CertificatesPage />;
      case 'history':
        return <HistoryPage />;
      case 'export':
        return <ExportPage />;
      default:
        return <StatisticsDashboard />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: collapsed ? 14 : 18, fontWeight: 'bold' }}>
          {collapsed ? '证书' : '培训证书系统'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selectedKey]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => setSelectedKey(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <h1 style={{ marginLeft: 24, fontSize: 20 }}>培训证书资格发放系统</h1>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
