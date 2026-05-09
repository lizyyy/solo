import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  WalletOutlined,
  ShopOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Receipts from './pages/Receipts';
import ReceiptDetail from './pages/ReceiptDetail';
import Balances from './pages/Balances';
import Settlements from './pages/Settlements';
import SettlementDetail from './pages/SettlementDetail';
import Duplicates from './pages/Duplicates';
import Appeals from './pages/Appeals';
import AppealDetail from './pages/AppealDetail';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '工作台概览' },
  { key: '/receipts', icon: <FileTextOutlined />, label: '小票管理' },
  { key: '/balances', icon: <WalletOutlined />, label: '补贴余额' },
  { key: '/settlements', icon: <ShopOutlined />, label: '商户结算' },
  { key: '/duplicates', icon: <CopyOutlined />, label: '重复识别' },
  { key: '/appeals', icon: <ExclamationCircleOutlined />, label: '异常申诉' },
];

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick = (e: { key: string }) => {
    navigate(e.key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ color: 'white' }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
          企业用餐补贴核销台
        </div>
      </Header>
      <Layout>
        <Sider width={220} theme="dark">
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
        <Content style={{ padding: '24px', background: '#f0f2f5' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/receipts" element={<Receipts />} />
            <Route path="/receipts/:id" element={<ReceiptDetail />} />
            <Route path="/balances" element={<Balances />} />
            <Route path="/settlements" element={<Settlements />} />
            <Route path="/settlements/:id" element={<SettlementDetail />} />
            <Route path="/duplicates" element={<Duplicates />} />
            <Route path="/appeals" element={<Appeals />} />
            <Route path="/appeals/:id" element={<AppealDetail />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
