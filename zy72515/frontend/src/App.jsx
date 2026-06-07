import React from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  UnorderedListOutlined,
  FileTextOutlined,
  DashboardOutlined
} from '@ant-design/icons'
import BatchList from './pages/BatchList'
import BatchDetail from './pages/BatchDetail'
import ReviewDashboard from './pages/ReviewDashboard'

const { Header, Sider, Content } = Layout

function App() {
  const location = useLocation()

  const menuItems = [
    {
      key: '/',
      icon: <UnorderedListOutlined />,
      label: <Link to="/">灰度批次列表</Link>
    },
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">产品复盘页</Link>
    }
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#001529', 
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{ color: '#fff', fontSize: '18px', fontWeight: 600 }}>
          <FileTextOutlined style={{ marginRight: 12 }} />
          智能排班建议解释系统
        </div>
      </Header>
      <Layout>
        <Sider width={220} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Content style={{ background: '#f5f5f5' }}>
          <Routes>
            <Route path="/" element={<BatchList />} />
            <Route path="/batch/:id" element={<BatchDetail />} />
            <Route path="/dashboard" element={<ReviewDashboard />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
