import React from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  TeamOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import GroupsPage from './pages/GroupsPage'
import ProductsPage from './pages/ProductsPage'
import OrdersPage from './pages/OrdersPage'
import OutOfStockPage from './pages/OutOfStockPage'
import CompensationPage from './pages/CompensationPage'

const { Header, Sider, Content } = Layout

const App = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    {
      key: '/groups',
      icon: <TeamOutlined />,
      label: '成团列表'
    },
    {
      key: '/products',
      icon: <ShoppingOutlined />,
      label: '商品规格'
    },
    {
      key: '/orders',
      icon: <ShoppingCartOutlined />,
      label: '订单管理'
    },
    {
      key: '/out-of-stock',
      icon: <WarningOutlined />,
      label: '异常订单'
    },
    {
      key: '/compensation',
      icon: <FileTextOutlined />,
      label: '补差明细'
    }
  ]

  return (
    <Layout className="layout">
      <Sider width={200} theme="dark">
        <div className="logo">拼团补差后台</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>社群拼团补差管理系统</h2>
        </Header>
        <Content className="content">
          <Routes>
            <Route path="/" element={<GroupsPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/out-of-stock" element={<OutOfStockPage />} />
            <Route path="/compensation" element={<CompensationPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
