import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout, Menu, Typography } from 'antd'
import {
  DashboardOutlined,
  AudioOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
  FileTextOutlined,
  ToolOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import { Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Devices from './pages/Devices'
import Orders from './pages/Orders'
import Exceptions from './pages/Exceptions'
import FlowRecords from './pages/FlowRecords'
import Repairs from './pages/Repairs'
import Reports from './pages/Reports'

const { Header, Sider, Content } = Layout
const { Title } = Typography

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">异常看板</Link> },
  { key: '/devices', icon: <AudioOutlined />, label: <Link to="/devices">设备管理</Link> },
  { key: '/orders', icon: <ShoppingCartOutlined />, label: <Link to="/orders">订单管理</Link> },
  { key: '/exceptions', icon: <WarningOutlined />, label: <Link to="/exceptions">异常管理</Link> },
  { key: '/flow', icon: <HistoryOutlined />, label: <Link to="/flow">流转记录</Link> },
  { key: '/repairs', icon: <ToolOutlined />, label: <Link to="/repairs">维修记录</Link> },
  { key: '/reports', icon: <FileTextOutlined />, label: <Link to="/reports">报告导出</Link> },
]

function AppContent() {
  const location = useLocation()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>
          景区讲解器租借赔付管理系统
        </Title>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/exceptions" element={<Exceptions />} />
              <Route path="/flow" element={<FlowRecords />} />
              <Route path="/repairs" element={<Repairs />} />
              <Route path="/reports" element={<Reports />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
