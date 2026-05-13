import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  CarOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import RoutesPage from './pages/Routes';
import Leaves from './pages/Leaves';
import Reports from './pages/Reports';
import './index.css';

const { Header, Content, Sider } = Layout;

function App() {
  const menuItems = [
    {
      key: '1',
      icon: <DashboardOutlined />,
      label: <Link to="/">异常看板</Link>,
    },
    {
      key: '2',
      icon: <UserOutlined />,
      label: <Link to="/students">学生管理</Link>,
    },
    {
      key: '3',
      icon: <CarOutlined />,
      label: <Link to="/routes">线路站点</Link>,
    },
    {
      key: '4',
      icon: <CalendarOutlined />,
      label: <Link to="/leaves">请假管理</Link>,
    },
    {
      key: '5',
      icon: <FileTextOutlined />,
      label: <Link to="/reports">报表导出</Link>,
    },
  ];

  return (
    <Router>
      <Layout className="layout">
        <Header style={{ display: 'flex', alignItems: 'center' }}>
          <div className="logo">校车点名系统</div>
          <Menu
            theme="dark"
            mode="horizontal"
            items={menuItems}
            style={{ flex: 1, minWidth: 0 }}
          />
        </Header>
        <Layout>
          <Sider width={200} style={{ background: '#fff' }}>
            <Menu
              mode="inline"
              defaultSelectedKeys={['1']}
              items={menuItems}
              style={{ height: '100%', borderRight: 0 }}
            />
          </Sider>
          <Layout style={{ padding: '0 24px 24px' }}>
            <Content className="site-layout-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/students" element={<Students />} />
                <Route path="/routes" element={<RoutesPage />} />
                <Route path="/leaves" element={<Leaves />} />
                <Route path="/reports" element={<Reports />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </Router>
  );
}

export default App;
