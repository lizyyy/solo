import React from 'react';
import { Layout as AntLayout, Menu, theme } from 'antd';
import {
  Image,
  ScanLine,
  Calculator,
  History,
  LayoutDashboard,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  {
    key: '/',
    icon: <LayoutDashboard size={18} />,
    label: '仪表盘',
  },
  {
    key: '/photos',
    icon: <Image size={18} />,
    label: '异常照片管理',
  },
  {
    key: '/scanner',
    icon: <ScanLine size={18} />,
    label: '磁场扫描图',
  },
  {
    key: '/validator',
    icon: <Calculator size={18} />,
    label: '单位换算校验',
  },
  {
    key: '/versions',
    icon: <History size={18} />,
    label: '版本历史中心',
  },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        style={{ background: '#001529' }}
      >
        <div className="flex items-center justify-center h-16 text-white text-lg font-semibold">
          <ScanLine className="mr-2" size={24} />
          实验室数据管理
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div className="px-6 flex items-center justify-between h-full">
            <h1 className="text-xl font-semibold text-gray-800">
            实验室异常数据管理系统
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">当前用户：张助教</span>
            </div>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px',
            padding: '24px',
            minHeight: 'calc(100vh - 112px)',
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};
