import React, { useState } from 'react';
import { Layout as AntLayout, Menu } from 'antd';
import {
  DashboardOutlined,
  FileSearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Sider, Content, Header } = AntLayout;

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: '仪表盘',
  },
  {
    key: '/incidents',
    icon: <FileSearchOutlined />,
    label: '事故列表',
  },
  {
    key: '/upload',
    icon: <UploadOutlined />,
    label: '文件上传',
  },
];

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/incidents/')) {
      return '/incidents';
    }
    return path;
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        theme="dark"
      >
        <div className="logo">
          {collapsed ? 'PRP' : '性能复盘台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            background: '#001529',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          本地运行时性能事故复盘台
        </Header>
        <Content style={{ margin: '16px', padding: 24, background: '#f0f2f5' }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
