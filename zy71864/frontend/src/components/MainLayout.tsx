import React from 'react';
import { Layout, Menu, Typography } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  BookOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Sider } = Layout;
const { Title } = Typography;

const menuItems: MenuProps['items'] = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: '首页仪表盘',
  },
  {
    key: '/question-bank',
    icon: <BookOutlined />,
    label: '题库管理',
  },
  {
    key: '/evaluation-records',
    icon: <FileTextOutlined />,
    label: '讲评记录',
  },
  {
    key: '/diagnosis',
    icon: <ExperimentOutlined />,
    label: '诊断中心',
  },
  {
    key: '/filter-conditions',
    icon: <FilterOutlined />,
    label: '筛选条件',
  },
];

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout className="min-h-screen">
      <Sider
        width={240}
        style={{
          background: 'linear-gradient(180deg, #1e3a5f 0%, #243b53 100%)',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
        }}
      >
        <div className="py-6 px-5 border-b border-white/10">
          <Title level={4} className="!m-0 !text-white font-serif">
            数列递推诊断
          </Title>
          <p className="text-white/60 text-xs mt-1">Sequence Diagnosis System</p>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="border-none mt-4"
          style={{
            background: 'transparent',
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="text-white/60 text-xs">
            <p>版本 1.0.0</p>
            <p className="mt-1">© 2024 教研团队</p>
          </div>
        </div>
      </Sider>

      <Layout className="ml-[240px]">
        <main className="p-6 min-h-[calc(100vh)]">{children}</main>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
