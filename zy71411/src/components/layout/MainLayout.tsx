import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Breadcrumb } from 'antd';
import {
  LayoutDashboard,
  GitBranch,
  Calculator,
  Receipt,
  History,
  FileText,
  Bell,
  ChevronDown,
  User,
  LogOut,
  Settings,
} from 'lucide-react';
import { useLocation, useNavigate, Link } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  {
    key: '/',
    icon: <LayoutDashboard size={18} />,
    label: '台账首页',
  },
  {
    key: '/contract-link',
    icon: <GitBranch size={18} />,
    label: '合约链路',
  },
  {
    key: '/points-calc',
    icon: <Calculator size={18} />,
    label: '点数计算',
  },
  {
    key: '/payment-match',
    icon: <Receipt size={18} />,
    label: '收付匹配',
  },
  {
    key: '/history',
    icon: <History size={18} />,
    label: '操作历史',
  },
  {
    key: '/report',
    icon: <FileText size={18} />,
    label: '批次报告',
  },
];

const userMenu = [
  {
    key: 'profile',
    icon: <User size={14} />,
    label: '个人信息',
  },
  {
    key: 'settings',
    icon: <Settings size={14} />,
    label: '系统设置',
  },
  {
    type: 'divider' as const,
  },
  {
    key: 'logout',
    icon: <LogOut size={14} />,
    label: '退出登录',
  },
];

const breadcrumbNames: Record<string, string> = {
  '/': '台账首页',
  '/contract-link': '合约链路',
  '/points-calc': '点数计算',
  '/payment-match': '收付匹配',
  '/history': '操作历史',
  '/report': '批次报告',
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Layout className="min-h-screen">
      <Sider width={240} className="bg-primary-900">
        <div className="h-16 flex items-center justify-center border-b border-primary-700">
          <h1 className="text-white font-serif text-lg font-bold tracking-wider">
            外汇远期展期台账
          </h1>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-r-0 mt-2"
        />
      </Sider>
      <Layout>
        <Header className="bg-white h-16 px-6 flex items-center justify-between border-b border-gray-200 shadow-sm">
          <Breadcrumb
            className="text-sm"
            items={[
              { title: <Link to="/">首页</Link> },
              { title: breadcrumbNames[location.pathname] },
            ]}
          />

          <div className="flex items-center gap-4">
            <Badge count={3} dot>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell size={20} className="text-gray-600" />
              </button>
            </Badge>

            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
                <Avatar size={32} className="bg-primary-700">
                  <User size={16} />
                </Avatar>
                <span className="text-sm font-medium text-gray-700">管理员</span>
                <ChevronDown size={14} className="text-gray-400" />
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="p-6 bg-gray-50">{children}</Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
