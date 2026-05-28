import React, { useState } from 'react';
import { Layout, Menu, Typography, Badge } from 'antd';
import {
  DashboardOutlined,
  ImportOutlined,
  CalculatorOutlined,
  LinkOutlined,
  SwapOutlined,
  FileTextOutlined,
  HistoryOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDataStore } from '../../store/dataStore';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '风险仪表盘' },
  { key: '/import', icon: <ImportOutlined />, label: '数据导入中心' },
  { key: '/exposure', icon: <CalculatorOutlined />, label: '敞口重算' },
  { key: '/matching', icon: <LinkOutlined />, label: '批次匹配' },
  { key: '/rollover', icon: <SwapOutlined />, label: '移仓追踪' },
  { key: '/export', icon: <FileTextOutlined />, label: '报告导出' },
  { key: '/audit', icon: <HistoryOutlined />, label: '修改追溯' },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { auditLogs } = useDataStore();

  const unreadWarnings = useDataStore((state) => {
    const warnings = state.auditLogs.length;
    return warnings;
  });

  return (
    <Layout className="min-h-screen">
      <Header
        style={{
          background: 'linear-gradient(90deg, #1976d2 0%, #1565c0 100%)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <Title
          level={4}
          style={{ color: 'white', margin: 0, marginRight: 'auto' }}
        >
          <AlertOutlined style={{ marginRight: 8 }} />
          期货套保敞口复核系统
        </Title>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
          <Badge count={auditLogs.length} offset={[5, -2]} size="small">
            <HistoryOutlined style={{ fontSize: 18, marginRight: 8 }} />
          </Badge>
          修改记录
        </div>
      </Header>
      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={220}
          style={{ background: '#fff' }}
        >
          <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ height: '100%', borderRight: 0, paddingTop: 16 }}
          items={menuItems.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            onClick: () => navigate(item.key),
          }))}
        />
        </Sider>
        <Layout style={{ padding: '24px', background: '#f5f7fa' }}>
          <Content
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 8,
              minHeight: 'calc(100vh - 130px)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {children}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
