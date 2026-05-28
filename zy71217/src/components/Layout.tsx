import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar, Badge } from 'antd';
import {
  CreditCardOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
  BarChartOutlined,
  UserOutlined,
  WarningOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store';

const { Header, Sider, Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { redemptions, resetToMockData, isInitialized, setInitialized } = useAppStore();

  useEffect(() => {
    if (!isInitialized || redemptions.length === 0) {
      resetToMockData();
      setInitialized();
    }
  }, []);

  const errorCount = redemptions.filter(r => r.currentBalance < 0).length;
  const disputeCount = redemptions.filter(r => r.hasDispute && !r.isFrozen).length;
  const duplicateCount = new Set(redemptions.map(r => r.cardNumber)).size < redemptions.length
    ? redemptions.length - new Set(redemptions.map(r => r.cardNumber)).size
    : 0;
  const alertCount = errorCount + disputeCount + duplicateCount;

  const menuItems = [
    {
      key: '/',
      icon: <CreditCardOutlined />,
      label: '兑付排队',
      badge: alertCount > 0 ? <Badge count={alertCount} size="small" /> : null
    },
    {
      key: '/batches',
      icon: <UnorderedListOutlined />,
      label: '批次管理'
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: '兑付报告'
    }
  ];

  const userMenuItems = [
    {
      key: 'reset',
      icon: <ReloadOutlined />,
      label: '重置演示数据',
      onClick: () => {
        resetToMockData();
        navigate('/');
      }
    }
  ];

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        className="fixed left-0 top-0 h-full z-50"
        style={{ background: 'linear-gradient(180deg, #001529 0%, #002766 100%)' }}
      >
        <div className="h-16 flex items-center justify-center px-4 border-b border-blue-800/30">
          <span className="text-white font-bold text-lg tracking-wider" style={{ fontFamily: 'Noto Serif SC, serif' }}>
            {collapsed ? '兑付' : '预付卡兑付系统'}
          </span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="border-none mt-2"
          style={{ background: 'transparent' }}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        <Header className="bg-white px-6 flex items-center justify-between shadow-sm" style={{ height: 64, lineHeight: '64px' }}>
          <div className="flex items-center gap-4">
            <Button
              type="text"
              icon={collapsed ? <span className="text-xl">»</span> : <span className="text-xl">«</span>}
              onClick={() => setCollapsed(!collapsed)}
              className="text-gray-600 hover:text-blue-600"
            />
            <h1 className="text-xl font-semibold text-gray-800 m-0" style={{ fontFamily: 'Noto Serif SC, serif' }}>
              预付卡兑付排队管理
            </h1>
          </div>

          <div className="flex items-center gap-6">
            {(errorCount > 0 || disputeCount > 0) && (
              <div className="flex items-center gap-3">
                {errorCount > 0 && (
                  <Badge count={errorCount} size="small" status="error">
                    <Button type="text" size="small" className="text-red-600 flex items-center gap-1">
                      <WarningOutlined /> 余额异常
                    </Button>
                  </Badge>
                )}
                {disputeCount > 0 && (
                  <Badge count={disputeCount} size="small" status="warning">
                    <Button type="text" size="small" className="text-orange-600 flex items-center gap-1">
                      <WarningOutlined /> 待冻结
                    </Button>
                  </Badge>
                )}
              </div>
            )}

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-1 rounded-lg transition-colors">
                <Avatar size="small" icon={<UserOutlined />} className="bg-blue-500" />
                <span className="text-gray-700">兑付专员A</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="p-6 bg-gray-50 min-h-[calc(100vh-64px)]">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
