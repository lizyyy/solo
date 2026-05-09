import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const { Content } = Layout;

export function MainLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header />
        <Content style={{
          margin: '24px 16px',
          padding: 24,
          background: '#fff',
          minHeight: 280,
          borderRadius: 4,
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;
