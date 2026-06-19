import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  FileTextOutlined,
  CalculatorOutlined,
  BarChartOutlined,
  HistoryOutlined,
  SettingOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import TransactionList from './pages/TransactionList';
import CalculationView from './pages/CalculationView';
import ChartView from './pages/ChartView';
import HistoryView from './pages/HistoryView';
import RulesView from './pages/RulesView';
import ReportView from './pages/ReportView';

const { Header, Content, Sider, Footer } = Layout;

const App: React.FC = () => {
  const menuItems = [
    {
      key: '/',
      icon: <FileTextOutlined />,
      label: <Link to="/">柜台流水管理</Link>,
    },
    {
      key: '/calculation',
      icon: <CalculatorOutlined />,
      label: <Link to="/calculation">保证金试算</Link>,
    },
    {
      key: '/charts',
      icon: <BarChartOutlined />,
      label: <Link to="/charts">3D图表展示</Link>,
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: <Link to="/history">历史版本</Link>,
    },
    {
      key: '/report',
      icon: <FileSearchOutlined />,
      label: <Link to="/report">试算报告</Link>,
    },
    {
      key: '/rules',
      icon: <SettingOutlined />,
      label: <Link to="/rules">边界规则说明</Link>,
    },
  ];

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <h1 className="app-title">期权保证金压力试算系统</h1>
        <div style={{ color: 'white' }}>当前用户：支付平台产品阿南</div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['/']}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: '0 24px 24px' }}>
          <Content className="app-content">
            <Routes>
              <Route path="/" element={<TransactionList />} />
              <Route path="/calculation" element={<CalculationView />} />
              <Route path="/charts" element={<ChartView />} />
              <Route path="/history" element={<HistoryView />} />
              <Route path="/report" element={<ReportView />} />
              <Route path="/rules" element={<RulesView />} />
            </Routes>
          </Content>
          <Footer className="app-footer">
            期权保证金压力试算系统 ©{new Date().getFullYear()} - 支付平台产品阿南专用
          </Footer>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default App;
