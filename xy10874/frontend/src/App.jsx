import React from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import { DashboardOutlined, AppstoreOutlined, FileTextOutlined } from '@ant-design/icons'
import Dashboard from './pages/Dashboard'
import PluginList from './pages/PluginList'
import PluginDetail from './pages/PluginDetail'

const { Header, Content } = Layout

function App() {
  const location = useLocation()

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">总览</Link>,
    },
    {
      key: '/plugins',
      icon: <AppstoreOutlined />,
      label: <Link to="/plugins">插件列表</Link>,
    },
  ]

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="app-logo">插件市场审核系统</div>
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname === '/' ? '/' : location.pathname.startsWith('/plugins') ? '/plugins' : '']}
          items={menuItems}
          style={{ minWidth: 200 }}
        />
      </Header>
      <Content className="app-content">
        <div className="content-card">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/plugins" element={<PluginList />} />
            <Route path="/plugins/:id" element={<PluginDetail />} />
          </Routes>
        </div>
      </Content>
    </Layout>
  )
}

export default App
