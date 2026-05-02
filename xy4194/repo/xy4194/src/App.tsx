import React, { useState, useEffect } from 'react'
import { Layout, Menu, theme, message } from 'antd'
import {
  HomeOutlined,
  ImportOutlined,
  TimelineOutlined,
  WarningOutlined,
  SaveOutlined,
  ExportOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'

import HomePage from './pages/HomePage'
import ImportPage from './pages/ImportPage'
import TimelinePage from './pages/TimelinePage'
import IssuesPage from './pages/IssuesPage'
import ExportPage from './pages/ExportPage'

import type { Project, Scene, PropStatus, ActorCall, PhotoInfo, ValidationIssue, Review } from './types'
import './App.css'

const { Header, Sider, Content } = Layout

type MenuKey = 'home' | 'import' | 'timeline' | 'issues' | 'export'

const menuItems: MenuProps['items'] = [
  {
    key: 'home',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: 'import',
    icon: <ImportOutlined />,
    label: '导入数据',
  },
  {
    key: 'timeline',
    icon: <TimelineOutlined />,
    label: '连续性时间线',
  },
  {
    key: 'issues',
    icon: <WarningOutlined />,
    label: '问题列表',
  },
  {
    key: 'export',
    icon: <ExportOutlined />,
    label: '导出报告',
  },
]

interface AppState {
  currentProject: Project | null
  scenes: Scene[]
  propStatus: PropStatus[]
  actorCalls: ActorCall[]
  photos: PhotoInfo[]
  issues: ValidationIssue[]
  reviews: Review[]
}

const initialState: AppState = {
  currentProject: null,
  scenes: [],
  propStatus: [],
  actorCalls: [],
  photos: [],
  issues: [],
  reviews: [],
}

function App() {
  const [selectedKey, setSelectedKey] = useState<MenuKey>('home')
  const [appState, setAppState] = useState<AppState>(initialState)
  const [messageApi, contextHolder] = message.useMessage()

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  // 更新数据
  const updateData = (updates: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...updates }))
  }

  // 显示消息
  const showMessage = (type: 'success' | 'error' | 'info', content: string) => {
    messageApi[type](content)
  }

  // 渲染内容
  const renderContent = () => {
    switch (selectedKey) {
      case 'home':
        return <HomePage appState={appState} onNavigate={setSelectedKey} />
      case 'import':
        return (
          <ImportPage
            appState={appState}
            onUpdateData={updateData}
            onMessage={showMessage}
          />
        )
      case 'timeline':
        return (
          <TimelinePage
            appState={appState}
            onMessage={showMessage}
          />
        )
      case 'issues':
        return (
          <IssuesPage
            appState={appState}
            onUpdateData={updateData}
            onMessage={showMessage}
          />
        )
      case 'export':
        return (
          <ExportPage
            appState={appState}
            onMessage={showMessage}
          />
        )
      default:
        return <HomePage appState={appState} onNavigate={setSelectedKey} />
    }
  }

  return (
    <Layout style={{ height: '100vh' }}>
      {contextHolder}
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: '20px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <FileTextOutlined />
          连续性穿帮核对台
          {appState.currentProject && (
            <span style={{ fontSize: '14px', fontWeight: 'normal', opacity: 0.8 }}>
              - {appState.currentProject.name}
            </span>
          )}
        </div>
      </Header>
      <Layout>
        <Sider
          width={200}
          style={{ background: colorBgContainer, borderRight: '1px solid #f0f0f0' }}
        >
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={({ key }) => setSelectedKey(key as MenuKey)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout
          style={{
            padding: '24px',
            overflow: 'auto',
            background: '#f5f5f5',
          }}
        >
          <Content
            style={{
              padding: '24px',
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              minHeight: 'calc(100vh - 180px)',
            }}
          >
            {renderContent()}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}

export default App
