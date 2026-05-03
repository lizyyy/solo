import React, { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Modal, message, theme } from 'antd'
import {
  DatabaseOutlined,
  VideoCameraOutlined,
  AlertOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import MaterialsPage from './pages/MaterialsPage'
import ProjectsPage from './pages/ProjectsPage'
import RiskCheckPage from './pages/RiskCheckPage'
import ReportPage from './pages/ReportPage'
import { initSampleData } from './services/api'

const { Header, Sider, Content } = Layout

const menuItems = [
  {
    key: '/materials',
    icon: <DatabaseOutlined />,
    label: '素材库管理',
  },
  {
    key: '/projects',
    icon: <VideoCameraOutlined />,
    label: '成片/项目',
  },
  {
    key: '/risk-check',
    icon: <AlertOutlined />,
    label: '授权检查',
  },
  {
    key: '/reports',
    icon: <FileTextOutlined />,
    label: '报告中心',
  },
]

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [sampleModalVisible, setSampleModalVisible] = useState(false)

  const handleMenuClick = ({ key }) => {
    navigate(key)
  }

  const handleInitSampleData = async () => {
    try {
      const result = await initSampleData()
      if (result.success) {
        message.success(`示例数据已加载：${result.materials} 个素材，${result.projects} 个项目，${result.timelines} 个时间轴片段`)
      } else {
        message.error('加载示例数据失败: ' + (result.errors?.[0] || '未知错误'))
      }
      setSampleModalVisible(false)
    } catch (error) {
      message.error('加载示例数据失败: ' + error.message)
    }
  }

  const selectedKey = location.pathname === '/' ? '/materials' : location.pathname

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        theme="dark"
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: collapsed ? 12 : 16,
          fontWeight: 'bold',
        }}>
          {collapsed ? 'MLC' : 'Media License Checker'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#333' }}>
            素材授权管理系统
          </div>
          <div className="action-buttons">
            <Button
              icon={<ExperimentOutlined />}
              onClick={() => setSampleModalVisible(true)}
            >
              加载示例数据
            </Button>
          </div>
        </Header>
        <Content style={{ margin: '0', padding: '0', background: '#f5f5f5' }}>
          <Routes>
            <Route path="/" element={<MaterialsPage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/risk-check" element={<RiskCheckPage />} />
            <Route path="/reports" element={<ReportPage />} />
          </Routes>
        </Content>
      </Layout>

      <Modal
        title="加载示例数据"
        open={sampleModalVisible}
        onOk={handleInitSampleData}
        onCancel={() => setSampleModalVisible(false)}
        okText="确认加载"
        cancelText="取消"
      >
        <p>这将加载以下示例数据：</p>
        <ul style={{ marginLeft: 20, marginTop: 12 }}>
          <li>6 个预置素材（音乐、视频、字体、图片）</li>
          <li>1 个示例项目</li>
          <li>5 个时间轴片段（包含多种风险场景）</li>
        </ul>
        <p style={{ marginTop: 12, color: '#666' }}>
          示例数据包含多种风险场景，可以直接用于测试授权检查功能。
        </p>
      </Modal>
    </Layout>
  )
}

export default App
