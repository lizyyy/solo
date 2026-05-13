import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import { 
  UserOutlined, 
  HomeOutlined, 
  CalendarOutlined, 
  FileTextOutlined,
  ClockCircleOutlined,
  SwitcherOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Wards from './pages/Wards';
import Caregivers from './pages/Caregivers';
import WardDemands from './pages/WardDemands';
import Schedules from './pages/Schedules';
import ScheduleDetail from './pages/ScheduleDetail';
import Leaves from './pages/Leaves';
import WorkHours from './pages/WorkHours';
import Reports from './pages/Reports';

const { Header, Content, Sider } = Layout;

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const menuItems = [
    { key: '/wards', icon: <HomeOutlined />, label: '病区管理' },
    { key: '/caregivers', icon: <UserOutlined />, label: '陪护人员' },
    { key: '/ward-demands', icon: <FileTextOutlined />, label: '病区需求' },
    { key: '/schedules', icon: <CalendarOutlined />, label: '排班管理' },
    { key: '/leaves', icon: <ClockCircleOutlined />, label: '请假管理' },
    { key: '/work-hours', icon: <SwitcherOutlined />, label: '工时账本' },
    { key: '/reports', icon: <BarChartOutlined />, label: '报表导出' }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255,255,255,0.2)' }} />
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['/wards']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0, fontSize: 18, fontWeight: 'bold', paddingLeft: 24 }}>
          陪护人员病区排班系统
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
          <Routes>
            <Route path="/wards" element={<Wards />} />
            <Route path="/caregivers" element={<Caregivers />} />
            <Route path="/ward-demands" element={<WardDemands />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/schedules/:id" element={<ScheduleDetail />} />
            <Route path="/leaves" element={<Leaves />} />
            <Route path="/work-hours" element={<WorkHours />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
