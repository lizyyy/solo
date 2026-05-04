import React, { useState, useEffect } from 'react'
import { Layout, Menu, Button, Modal, Form, Input, message, Space, FloatButton } from 'antd'
import {
  DashboardOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepForwardOutlined,
  PlusOutlined,
  FireOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import useStore from './store'
import FloorViewer from './components/FloorViewer'
import ControlPanel from './components/ControlPanel'
import TimelinePanel from './components/TimelinePanel'
import StatusPanel from './components/StatusPanel'
import RiskIndicator from './components/RiskIndicator'
import SetupPanel from './components/SetupPanel'
import ExportPanel from './components/ExportPanel'
import './App.css'

const { Header, Sider, Content } = Layout

function App() {
  const [selectedKey, setSelectedKey] = useState('simulation')
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const {
    floors,
    currentDrill,
    isSimulating,
    isPaused,
    riskAssessment,
    loadFloors,
    loadExits,
    loadPersons,
    loadCurrentDrill,
    createDrill,
    startDrill,
    pauseDrill,
    resumeDrill,
    stepDrill,
    startAutoStep,
    stopAutoStep,
    completeDrill,
    setAddingFirePoint,
    isAddingFirePoint,
  } = useStore()

  useEffect(() => {
    loadFloors()
    loadExits()
    loadPersons()
    loadCurrentDrill()
  }, [])

  const handleCreateDrill = async (values) => {
    try {
      await createDrill(values.name)
      messageApi.success('演练创建成功')
      setIsSetupModalOpen(false)
    } catch (error) {
      messageApi.error('创建演练失败: ' + error.message)
    }
  }

  const handleStartDrill = async () => {
    if (!currentDrill) {
      messageApi.warning('请先创建演练')
      return
    }
    try {
      await startDrill(currentDrill.id)
      startAutoStep(800)
      messageApi.success('演练开始')
    } catch (error) {
      messageApi.error('开始演练失败: ' + error.message)
    }
  }

  const handlePauseDrill = async () => {
    try {
      if (isPaused) {
        await resumeDrill()
        startAutoStep(800)
        messageApi.info('演练恢复')
      } else {
        stopAutoStep()
        await pauseDrill()
        messageApi.info('演练已暂停')
      }
    } catch (error) {
      messageApi.error('操作失败: ' + error.message)
    }
  }

  const handleStepDrill = async () => {
    try {
      stopAutoStep()
      await stepDrill()
    } catch (error) {
      messageApi.error('单步推进失败: ' + error.message)
    }
  }

  const handleCompleteDrill = async () => {
    Modal.confirm({
      title: '确认完成演练',
      content: '完成后将无法继续模拟，是否继续？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await completeDrill()
          messageApi.success('演练已完成')
        } catch (error) {
          messageApi.error('完成演练失败: ' + error.message)
        }
      },
    })
  }

  const handleToggleFirePointMode = () => {
    if (!currentDrill) {
      messageApi.warning('请先开始演练')
      return
    }
    setAddingFirePoint(!isAddingFirePoint)
    if (!isAddingFirePoint) {
      messageApi.info('点击楼层平面图设置起火点')
    }
  }

  const menuItems = [
    {
      key: 'simulation',
      icon: <DashboardOutlined />,
      label: '模拟演练',
    },
    {
      key: 'setup',
      icon: <SettingOutlined />,
      label: '环境配置',
    },
  ]

  const renderContent = () => {
    switch (selectedKey) {
      case 'setup':
        return <SetupPanel />
      case 'simulation':
      default:
        return (
          <div className="simulation-content">
            <div className="viewer-container">
              <FloorViewer />
            </div>
            
            <div className="side-panels">
              <RiskIndicator risk={riskAssessment} />
              <StatusPanel />
              <TimelinePanel />
            </div>
          </div>
        )
    }
  }

  return (
    <Layout className="app-layout">
      {contextHolder}
      
      <Header className="app-header">
        <div className="header-left">
          <FireOutlined className="logo-icon" />
          <span className="app-title">消防疏散三维演练台</span>
        </div>
        
        <div className="header-center">
          {currentDrill && (
            <Space>
              <span className="drill-name">当前演练: {currentDrill.name}</span>
              <span className="time-step">时间步: {currentDrill.current_time_step || 0}</span>
              {currentDrill.status === 'running' && (
                <span className={`status-badge ${isPaused ? 'paused' : 'running'}`}>
                  {isPaused ? '已暂停' : '运行中'}
                </span>
              )}
              {currentDrill.status === 'completed' && (
                <span className="status-badge completed">已完成</span>
              )}
            </Space>
          )}
        </div>
        
        <div className="header-right">
          <Space>
            {!currentDrill ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsSetupModalOpen(true)}
              >
                创建演练
              </Button>
            ) : currentDrill.status === 'created' ? (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStartDrill}
              >
                开始演练
              </Button>
            ) : currentDrill.status === 'running' ? (
              <Space>
                <Button
                  icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                  onClick={handlePauseDrill}
                >
                  {isPaused ? '继续' : '暂停'}
                </Button>
                <Button icon={<StepForwardOutlined />} onClick={handleStepDrill}>
                  单步
                </Button>
                <Button
                  type={isAddingFirePoint ? 'primary' : 'default'}
                  icon={<FireOutlined />}
                  onClick={handleToggleFirePointMode}
                >
                  设置起火点
                </Button>
                <Button onClick={handleCompleteDrill}>完成演练</Button>
              </Space>
            ) : currentDrill.status === 'completed' ? (
              <Space>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => setIsExportModalOpen(true)}
                >
                  导出报告
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    useStore.getState().resetState()
                    setIsSetupModalOpen(true)
                  }}
                >
                  新建演练
                </Button>
              </Space>
            ) : null}
          </Space>
        </div>
      </Header>

      <Layout>
        <Sider width={200} className="app-sider">
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            onClick={({ key }) => setSelectedKey(key)}
            items={menuItems}
          />
          
          <ControlPanel />
        </Sider>

        <Content className="app-content">
          {renderContent()}
        </Content>
      </Layout>

      <Modal
        title="创建新演练"
        open={isSetupModalOpen}
        onCancel={() => setIsSetupModalOpen(false)}
        footer={null}
      >
        <Form onFinish={handleCreateDrill} layout="vertical">
          <Form.Item
            name="name"
            label="演练名称"
            rules={[{ required: true, message: '请输入演练名称' }]}
          >
            <Input placeholder="例如: 教学楼消防演练" />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setIsSetupModalOpen(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导出演练报告"
        open={isExportModalOpen}
        onCancel={() => setIsExportModalOpen(false)}
        footer={null}
        width={800}
      >
        <ExportPanel onClose={() => setIsExportModalOpen(false)} />
      </Modal>

      {isAddingFirePoint && (
        <FloatButton
          description="点击平面图设置起火点"
          type="primary"
          icon={<FireOutlined />}
          onClick={handleToggleFirePointMode}
          tooltip="取消设置起火点"
        />
      )}
    </Layout>
  )
}

export default App
