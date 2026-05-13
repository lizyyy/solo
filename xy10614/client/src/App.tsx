import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Layout, Menu, theme } from 'antd'
import { FileTextOutlined, BarChartOutlined, DownloadOutlined, UserOutlined } from '@ant-design/icons'
import VisitorList from './pages/VisitorList'
import OperationLogs from './pages/OperationLogs'
import ExportPage from './pages/ExportPage'
import VisitorDetail from './pages/VisitorDetail'

const { Header, Content, Sider } = Layout

function App() {
  const {
    token: { colorBgContainer },
  } = theme.useToken()

  const location = useLocation()

  const menuItems = [
    {
      key: '/',
      icon: <UserOutlined />,
      label: <Link to="/">访客管理</Link>,
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: <Link to="/logs">操作日志</Link>,
    },
    {
      key: '/export',
      icon: <DownloadOutlined />,
      label: <Link to="/export">报表导出</Link>,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 'bold', color: '#1890ff' }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          访客管理系统
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, display: 'flex', alignItems: 'center', paddingLeft: 20, fontSize: 18, fontWeight: 'bold' }}>
          园区访客通行核销系统
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: colorBgContainer, minHeight: 280 }}>
          <Routes>
            <Route path="/" element={<VisitorList />} />
            <Route path="/logs" element={<OperationLogs />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/visitor/:id" element={<VisitorDetail />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
