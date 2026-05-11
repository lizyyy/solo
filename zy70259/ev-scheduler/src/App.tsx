import { useEffect, useState } from 'react'
import { Layout, Menu, ConfigProvider, theme } from 'antd'
import {
  DashboardOutlined,
  CarOutlined,
  TeamOutlined,
  ScheduleOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useStore } from '@/store'
import Dashboard from '@/components/Dashboard'
import VehicleManagement from '@/components/VehicleManagement'
import ConsultantManagement from '@/components/ConsultantManagement'
import ScheduleManagement from '@/components/ScheduleManagement'
import ReservationManagement from '@/components/ReservationManagement'
import Guide from '@/components/Guide'
import './App.css'

const { Header, Sider, Content } = Layout

type MenuItem = 'dashboard' | 'vehicles' | 'consultants' | 'schedules' | 'reservations' | 'guide'

function App() {
  const [selectedKey, setSelectedKey] = useState<MenuItem>('guide')
  const initialize = useStore(state => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  const menuItems = [
    { key: 'guide', icon: <FileTextOutlined />, label: '使用说明' },
    { key: 'dashboard', icon: <DashboardOutlined />, label: '调度看板' },
    { key: 'vehicles', icon: <CarOutlined />, label: '试驾车档案' },
    { key: 'consultants', icon: <TeamOutlined />, label: '销售顾问' },
    { key: 'schedules', icon: <ScheduleOutlined />, label: '排班管理' },
    { key: 'reservations', icon: <ThunderboltOutlined />, label: '预约管理' },
  ]

  const renderContent = () => {
    switch (selectedKey) {
      case 'dashboard':
        return <Dashboard />
      case 'vehicles':
        return <VehicleManagement />
      case 'consultants':
        return <ConsultantManagement />
      case 'schedules':
        return <ScheduleManagement />
      case 'reservations':
        return <ReservationManagement />
      case 'guide':
      default:
        return <Guide />
    }
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#00b96b',
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={220} style={{ background: '#001529' }}>
          <div style={{
            height: 64,
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#002140',
          }}>
            试驾调度台
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => setSelectedKey(key as MenuItem)}
          />
        </Sider>
        <Layout>
          <Header style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}>
            <span style={{ fontSize: 20, fontWeight: 600 }}>
              {menuItems.find(m => m.key === selectedKey)?.label}
            </span>
            <span style={{ color: '#888', fontSize: 14 }}>
              数据自动保存，刷新不丢失
            </span>
          </Header>
          <Content style={{ margin: 24, background: '#fff', padding: 24, minHeight: 280 }}>
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}

export default App
