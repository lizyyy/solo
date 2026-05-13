import React from 'react'
import { Layout, Menu, theme } from 'antd'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { 
  DashboardOutlined, 
  CreditCardOutlined, 
  ReconciliationOutlined, 
  ShoppingOutlined,
  RollbackOutlined,
  FileSearchOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import Dashboard from './pages/Dashboard'
import Cards from './pages/Cards'
import Transactions from './pages/Transactions'
import Recharge from './pages/Recharge'
import Refund from './pages/Refund'
import DuplicateDeductions from './pages/DuplicateDeductions'
import Reconciliation from './pages/Reconciliation'
import AuditLogs from './pages/AuditLogs'
import Demo from './pages/Demo'

const { Header, Content, Sider } = Layout

function App() {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '数据概览' },
    { key: '/cards', icon: <CreditCardOutlined />, label: '餐卡管理' },
    { key: '/transactions', icon: <ShoppingOutlined />, label: '交易记录' },
    { key: '/recharge', icon: <ReconciliationOutlined />, label: '充值订单' },
    { key: '/refund', icon: <RollbackOutlined />, label: '退款管理' },
    { key: '/duplicates', icon: <FileSearchOutlined />, label: '重复扣款处理' },
    { key: '/reconciliation', icon: <FileTextOutlined />, label: '食堂对账' },
    { key: '/audit', icon: <FileSearchOutlined />, label: '审计日志' },
    { key: '/demo', icon: <DashboardOutlined />, label: '演示路径' },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={200}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 'bold' }}>
          校园餐卡系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ paddingLeft: 24, fontSize: 18, fontWeight: 'bold' }}>
            校园餐卡离线补账系统
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cards" element={<Cards />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/recharge" element={<Recharge />} />
            <Route path="/refund" element={<Refund />} />
            <Route path="/duplicates" element={<DuplicateDeductions />} />
            <Route path="/reconciliation" element={<Reconciliation />} />
            <Route path="/audit" element={<AuditLogs />} />
            <Route path="/demo" element={<Demo />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
