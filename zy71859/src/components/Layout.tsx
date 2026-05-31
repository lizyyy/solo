import { ReactNode, useState } from 'react'
import { Layout, Menu, Avatar, Dropdown } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Package,
  Video,
  Layers,
  History,
  User,
  Settings,
  LogOut,
} from 'lucide-react'

const { Sider, Content, Header } = Layout

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const menuItems = [
    {
      key: '/dashboard',
      icon: <LayoutDashboard size={18} />,
      label: '工作台',
      onClick: () => navigate('/dashboard'),
    },
    {
      key: '/records',
      icon: <FileText size={18} />,
      label: '练习记录',
      onClick: () => navigate('/records'),
    },
    {
      key: '/parts',
      icon: <Package size={18} />,
      label: '零件清单',
      onClick: () => navigate('/parts'),
    },
    {
      key: '/scripts',
      icon: <Video size={18} />,
      label: '演示脚本',
      onClick: () => navigate('/scripts'),
    },
    {
      key: '/batch',
      icon: <Layers size={18} />,
      label: '批量处理',
      onClick: () => navigate('/batch'),
    },
    {
      key: '/audit',
      icon: <History size={18} />,
      label: '审计日志',
      onClick: () => navigate('/audit'),
    },
  ]

  const userMenuItems = [
    {
      key: 'profile',
      icon: <User size={16} />,
      label: '个人信息',
    },
    {
      key: 'settings',
      icon: <Settings size={16} />,
      label: '系统设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogOut size={16} />,
      label: '退出登录',
    },
  ]

  return (
    <Layout className="min-h-screen">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        style={{ background: '#0F4C5C' }}
      >
        <div className="h-16 flex items-center justify-center text-white font-bold text-lg border-b border-white/10">
          {collapsed ? 'PCB' : '焊接练习系统'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ background: '#0F4C5C', border: 'none' }}
          theme="dark"
        />
      </Sider>
      <Layout>
        <Header className="bg-white border-b border-gray-200 px-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">
            {menuItems.find((m) => m.key === location.pathname)?.label || '系统'}
          </h1>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
              <Avatar size={32} style={{ backgroundColor: '#0F4C5C' }}>
                张
              </Avatar>
              <span className="text-sm text-gray-700">张老师</span>
            </div>
          </Dropdown>
        </Header>
        <Content className="p-6 bg-gray-50">{children}</Content>
      </Layout>
    </Layout>
  )
}
