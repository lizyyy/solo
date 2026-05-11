import React, { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Dropdown, Button, message, Space } from 'antd'
import {
  DashboardOutlined,
  InboxOutlined,
  UnorderedListOutlined,
  SyncOutlined,
  FileTextOutlined,
  TeamOutlined,
  LogoutOutlined,
  UserOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { authStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import InventoryPage from './pages/InventoryPage'
import TasksPage from './pages/TasksPage'
import SyncPage from './pages/SyncPage'
import LogsPage from './pages/LogsPage'
import UsersPage from './pages/UsersPage'
import type { MenuProps } from 'antd'

const { Header, Sider, Content } = Layout

type PageKey = 'dashboard' | 'inventory' | 'tasks' | 'sync' | 'logs' | 'users'

function App() {
  const [page, setPage] = useState<PageKey>('dashboard')
  const [, forceUpdate] = useState({})

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => forceUpdate({}))
    return () => {
      unsubscribe()
    }
  }, [])

  if (!authStore.isAuthenticated) {
    return <LoginPage onLogin={() => forceUpdate({})} />
  }

  const menuItems: MenuProps['items'] = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '控制台' },
    { key: 'inventory', icon: <InboxOutlined />, label: '库存管理' },
    { key: 'tasks', icon: <UnorderedListOutlined />, label: '盘点任务' },
    { key: 'sync', icon: <SyncOutlined />, label: '同步中心' },
    { key: 'logs', icon: <FileTextOutlined />, label: '审计日志' },
  ]

  if (authStore.isAdmin) {
    menuItems.push({ key: 'users', icon: <TeamOutlined />, label: '用户管理' })
  }

  const userMenu: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        authStore.logout()
        message.success('已退出登录')
      },
    },
  ]

  const refreshPage = () => {
    forceUpdate({})
    message.success('已刷新')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 'bold' }}>
          仓库盘点系统
        </div>
        <Menu
          theme="dark"
          selectedKeys={[page]}
          items={menuItems}
          onClick={({ key }) => setPage(key as PageKey)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <h2 style={{ margin: 0 }}>
              {(menuItems.find((i: any) => i.key === page) as any)?.label as string}
            </h2>
            <Button icon={<ReloadOutlined />} onClick={refreshPage}>刷新</Button>
          </Space>
          <Space>
            <span>当前用户: <strong>{authStore.currentUser?.name}</strong> ({authStore.isAdmin ? '管理员' : '盘点员'})</span>
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 24, background: '#fff', padding: 24, minHeight: 280 }}>
          {page === 'dashboard' && <DashboardPage />}
          {page === 'inventory' && <InventoryPage />}
          {page === 'tasks' && <TasksPage />}
          {page === 'sync' && <SyncPage />}
          {page === 'logs' && <LogsPage />}
          {page === 'users' && <UsersPage />}
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
