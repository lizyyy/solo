import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { 
  DashboardOutlined, 
  UnorderedListOutlined,
  TeamOutlined,
  SettingOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import LeadList from './pages/LeadList';
import SalesDashboard from './pages/SalesDashboard';
import AssignmentRules from './pages/AssignmentRules';

const { Sider, Content } = Layout;

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '数据看板' },
    { key: '/leads', icon: <UnorderedListOutlined />, label: '线索列表' },
    { key: '/sales', icon: <TeamOutlined />, label: '销售看板' },
    { key: '/rules', icon: <SettingOutlined />, label: '分配规则' }
  ];

  const getSelectedKeys = () => {
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      return ['/dashboard'];
    }
    return [location.pathname];
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} style={{ background: '#001529' }}>
        <div style={{ 
          height: 64, 
          color: 'white', 
          fontSize: 18, 
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <FileExcelOutlined style={{ marginRight: 8 }} />
          展会线索分配台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Content style={{ margin: '24px', background: '#f0f2f5' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leads" element={<LeadList />} />
            <Route path="/sales" element={<SalesDashboard />} />
            <Route path="/rules" element={<AssignmentRules />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
