import React from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  FolderOpenOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Sider } = Layout;

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '总览',
    },
    {
      key: '/collections',
      icon: <FolderOpenOutlined />,
      label: '巡检集合',
    },
    {
      key: '/environments',
      icon: <SettingOutlined />,
      label: '环境配置',
    },
  ];

  return (
    <Sider width={200}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
          巡检面板
        </div>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  );
}

export default Sidebar;
