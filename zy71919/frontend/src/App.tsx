import { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, theme } from 'antd'
import {
  SearchOutlined,
  ImportOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  ExportOutlined,
} from '@ant-design/icons'
import MaterialsPage from '@/pages/MaterialsPage'
import ImportPage from '@/pages/ImportPage'
import ReviewPage from '@/pages/ReviewPage'
import HistoryPage from '@/pages/HistoryPage'
import ExportPage from '@/pages/ExportPage'

const { Header, Sider, Content } = Layout

const menuItems = [
  {
    key: '/materials',
    icon: <SearchOutlined />,
    label: '素材检索',
  },
  {
    key: '/import',
    icon: <ImportOutlined />,
    label: '导入管理',
  },
  {
    key: '/review',
    icon: <CheckCircleOutlined />,
    label: '复核修正',
  },
  {
    key: '/history',
    icon: <HistoryOutlined />,
    label: '历史追溯',
  },
  {
    key: '/export',
    icon: <ExportOutlined />,
    label: '导出管理',
  },
]

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="flex items-center justify-between px-6">
        <div className="flex items-center">
          <div className="text-white text-xl font-bold mr-8">环境音素材检索系统</div>
        </div>
        <div className="text-gray-300 text-sm">
          v1.0.0
        </div>
      </Header>
      <Layout>
        <Sider
          width={200}
          theme="dark"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{ background: '#1e293b' }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ borderRight: 0, background: '#1e293b' }}
            theme="dark"
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Routes>
              <Route path="/" element={<MaterialsPage />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/export" element={<ExportPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}

export default App
