import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Layout,
  Button,
  Tabs,
  Card,
  List,
  Input,
  InputNumber,
  Select,
  Form,
  Modal,
  Upload,
  message,
  Popconfirm,
  Tag,
  Badge,
  Divider,
  Collapse,
  Space,
  Tooltip,
  Typography,
  Radio,
  Checkbox
} from 'antd'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  UserOutlined,
  VideoCameraOutlined,
  CalendarOutlined,
  WarningOutlined,
  ImportOutlined,
  ExportOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  SafetyOutlined
} from '@ant-design/icons'
import { useStore } from '@/store'
import { planApi, lightApi, actorApi, cameraApi, scheduleApi, riskApi, importApi, exportApi } from '@/services/api'
import StudioScene from '@/components/StudioScene'
import { Vec3, PlacedLight, Actor, Camera, ScheduleItem, RiskItem, RiskSeverity, RiskType } from '@/types'

const { Header, Content } = Layout
const { TabPane } = Tabs
const { Panel } = Collapse
const { Title, Text } = Typography

export default function Editor() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const { 
    plan, 
    lights, 
    actors, 
    cameras, 
    schedule, 
    risks,
    editor,
    setPlanDetail,
    clearPlan,
    setSelectedObject
  } = useStore()
  
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('lights')
  const [addLightModal, setAddLightModal] = useState(false)
  const [addActorModal, setAddActorModal] = useState(false)
  const [addCameraModal, setAddCameraModal] = useState(false)
  const [addScheduleModal, setAddScheduleModal] = useState(false)
  const [overrideModal, setOverrideModal] = useState(false)
  const [currentRisk, setCurrentRisk] = useState<RiskItem | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [lightForm] = Form.useForm()
  const [actorForm] = Form.useForm()
  const [cameraForm] = Form.useForm()
  const [scheduleForm] = Form.useForm()

  const loadPlanData = useCallback(async () => {
    if (!planId) return
    setLoading(true)
    try {
      const res = await planApi.getById(planId)
      if (res.success && res.data) {
        setPlanDetail(res.data)
      }
    } catch (error) {
      message.error('加载方案失败')
    } finally {
      setLoading(false)
    }
  }, [planId, setPlanDetail])

  useEffect(() => {
    loadPlanData()
    return () => {
      clearPlan()
    }
  }, [loadPlanData, clearPlan])

  const calculateRisks = async () => {
    if (!planId) return
    try {
      const res = await riskApi.calculate(planId)
      if (res.success) {
        message.success(`检测到 ${res.data?.length || 0} 个风险项`)
        loadPlanData()
      }
    } catch (error) {
      message.error('风险计算失败')
    }
  }

  const handleOverrideRisk = async () => {
    if (!planId || !currentRisk) return
    try {
      const res = await riskApi.override(planId, currentRisk.id, {
        isOverridden: !currentRisk.isOverridden,
        overrideReason,
        overrideBy: 'user'
      })
      if (res.success) {
        message.success(currentRisk.isOverridden ? '已恢复风险' : '已人工改判')
        setOverrideModal(false)
        setOverrideReason('')
        setCurrentRisk(null)
        loadPlanData()
      }
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleExportMarkdown = async () => {
    if (!planId) return
    try {
      await exportApi.exportMarkdown(planId)
      message.success('Markdown 交接单已导出')
    } catch (error) {
      message.error('导出失败')
    }
  }

  const handleExportJson = async () => {
    if (!planId) return
    try {
      await exportApi.exportJson(planId)
      message.success('JSON 审计包已导出')
    } catch (error) {
      message.error('导出失败')
    }
  }

  const handleAddLight = async (values: any) => {
    if (!planId) return
    try {
      const res = await lightApi.create(planId, {
        name: values.name,
        type: values.type || '',
        power: values.power || 0,
        colorTemp: values.colorTemp || 5600,
        dmxChannel: values.dmxChannel,
        isHighTemp: values.isHighTemp || false,
        position: { x: 0, y: 1.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        intensity: 1,
        color: '#ffffff',
        standHeight: values.standHeight || 2,
        notes: ''
      })
      if (res.success) {
        message.success('灯具已添加')
        setAddLightModal(false)
        lightForm.resetFields()
        loadPlanData()
      }
    } catch (error) {
      message.error('添加失败')
    }
  }

  const handleAddActor = async (values: any) => {
    if (!planId) return
    try {
      const res = await actorApi.create(planId, {
        name: values.name,
        position: { x: values.x || 0, y: 0, z: values.z || 0 },
        rotation: { x: 0, y: values.rotationY || 0, z: 0 }
      })
      if (res.success) {
        message.success('演员已添加')
        setAddActorModal(false)
        actorForm.resetFields()
        loadPlanData()
      }
    } catch (error) {
      message.error('添加失败')
    }
  }

  const handleAddCamera = async (values: any) => {
    if (!planId) return
    try {
      const res = await cameraApi.create(planId, {
        name: values.name,
        position: { x: values.x || 0, y: 1.5, z: values.z || 0 },
        rotation: { x: 0, y: values.rotationY || 0, z: 0 },
        lens: values.lens || '50mm',
        fov: values.fov || 60
      })
      if (res.success) {
        message.success('机位已添加')
        setAddCameraModal(false)
        cameraForm.resetFields()
        loadPlanData()
      }
    } catch (error) {
      message.error('添加失败')
    }
  }

  const handleAddSchedule = async (values: any) => {
    if (!planId) return
    try {
      const res = await scheduleApi.create(planId, {
        sceneId: values.sceneId,
        sceneName: values.sceneName,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        lightIds: values.lightIds || [],
        cameraIds: values.cameraIds || [],
        actorIds: values.actorIds || [],
        notes: values.notes || ''
      })
      if (res.success) {
        message.success('场次已添加')
        setAddScheduleModal(false)
        scheduleForm.resetFields()
        loadPlanData()
      }
    } catch (error) {
      message.error('添加失败')
    }
  }

  const handleDeleteLight = async (id: string) => {
    if (!planId) return
    try {
      await lightApi.delete(planId, id)
      message.success('灯具已删除')
      setSelectedObject(null, null)
      loadPlanData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleDeleteActor = async (id: string) => {
    if (!planId) return
    try {
      await actorApi.delete(planId, id)
      message.success('演员已删除')
      setSelectedObject(null, null)
      loadPlanData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleDeleteCamera = async (id: string) => {
    if (!planId) return
    try {
      await cameraApi.delete(planId, id)
      message.success('机位已删除')
      setSelectedObject(null, null)
      loadPlanData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleDeleteSchedule = async (id: string) => {
    if (!planId) return
    try {
      await scheduleApi.delete(planId, id)
      message.success('场次已删除')
      loadPlanData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleImportLights = async (file: File) => {
    if (!planId) return
    try {
      const res = await importApi.importLights(planId, file)
      if (res.success) {
        message.success(`成功导入 ${res.data?.length || 0} 个灯具`)
        loadPlanData()
      }
    } catch (error) {
      message.error('导入失败')
    }
    return false
  }

  const handleImportCameraActor = async (file: File) => {
    if (!planId) return
    try {
      const res = await importApi.importCameraActor(planId, file)
      if (res.success) {
        const actors = res.data?.actors?.length || 0
        const cameras = res.data?.cameras?.length || 0
        message.success(`成功导入 ${actors} 个演员，${cameras} 个机位`)
        loadPlanData()
      }
    } catch (error) {
      message.error('导入失败')
    }
    return false
  }

  const handleImportSchedule = async (file: File) => {
    if (!planId) return
    try {
      const res = await importApi.importSchedule(planId, file)
      if (res.success) {
        message.success(`成功导入 ${res.data?.length || 0} 个场次`)
        loadPlanData()
      }
    } catch (error) {
      message.error('导入失败')
    }
    return false
  }

  const getSelectedObject = () => {
    if (!editor.selectedObjectId || !editor.selectedType) return null
    switch (editor.selectedType) {
      case 'light':
        return lights.find(l => l.id === editor.selectedObjectId)
      case 'actor':
        return actors.find(a => a.id === editor.selectedObjectId)
      case 'camera':
        return cameras.find(c => c.id === editor.selectedObjectId)
      default:
        return null
    }
  }

  const selectedObject = getSelectedObject()

  const getPowerStatus = () => {
    if (!plan) return { ratio: 0, className: 'normal' }
    const ratio = plan.totalPower / plan.maxPowerLimit
    if (ratio > 1) return { ratio, className: 'danger' }
    if (ratio > 0.8) return { ratio, className: 'warning' }
    return { ratio, className: 'normal' }
  }

  const getSeverityColor = (severity: RiskSeverity) => {
    switch (severity) {
      case 'critical': return '#ff4d4f'
      case 'high': return '#fa8c16'
      case 'medium': return '#faad14'
      case 'low': return '#52c41a'
      default: return '#666'
    }
  }

  const getSeverityLabel = (severity: RiskSeverity) => {
    switch (severity) {
      case 'critical': return '严重'
      case 'high': return '高'
      case 'medium': return '中'
      case 'low': return '低'
      default: return severity
    }
  }

  const getTypeLabel = (type: RiskType) => {
    switch (type) {
      case 'power_overload': return '功率超载'
      case 'light_stand_blocking': return '灯架遮挡'
      case 'actor_near_high_temp': return '高温风险'
      case 'light_schedule_conflict': return '场次冲突'
      default: return '其他'
    }
  }

  const powerStatus = getPowerStatus()
  const activeRisks = risks.filter(r => !r.isOverridden)
  const overriddenRisks = risks.filter(r => r.isOverridden)

  if (loading || !plan) {
    return (
      <Layout style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>加载中...</div>
      </Layout>
    )
  }

  return (
    <Layout className="editor-page">
      <Header style={{ 
        background: '#001529', 
        display: 'flex', 
        alignItems: 'center',
        padding: '0 24px',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/')}
            style={{ color: 'white' }}
          >
            返回
          </Button>
          <div style={{ color: 'white' }}>
            <Title level={4} style={{ color: 'white', margin: 0 }}>{plan.name}</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {plan.studioDimensions.width}m × {plan.studioDimensions.depth}m × {plan.studioDimensions.height}m
            </Text>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="power-indicator">
            <ThunderboltOutlined style={{ color: powerStatus.ratio > 1 ? '#ff4d4f' : '#52c41a' }} />
            <div className="power-bar">
              <div 
                className={`power-fill ${powerStatus.className}`}
                style={{ width: `${Math.min(powerStatus.ratio * 100, 100)}%` }}
              />
            </div>
            <Text style={{ color: 'white', fontSize: 12 }}>
              {plan.totalPower}W / {plan.maxPowerLimit}W
            </Text>
          </div>

          <Badge count={activeRisks.length} size="small">
            <Button icon={<WarningOutlined />} onClick={calculateRisks}>
              风险检测
            </Button>
          </Badge>

          <Button icon={<ExportOutlined />} onClick={handleExportMarkdown}>
            导出 MD
          </Button>
          <Button type="primary" icon={<ExportOutlined />} onClick={handleExportJson}>
            导出 JSON
          </Button>
        </div>
      </Header>

      <div className="editor-layout">
        <div className="editor-canvas">
          <StudioScene
            dimensions={plan.studioDimensions}
            lights={lights}
            actors={actors}
            cameras={cameras}
          />

          {selectedObject && (
            <div className="selected-info">
              <Text strong>
                {editor.selectedType === 'light' && <BulbOutlined />}
                {editor.selectedType === 'actor' && <UserOutlined />}
                {editor.selectedType === 'camera' && <VideoCameraOutlined />}
                {' '}
                {(selectedObject as any).name}
              </Text>
              <Text type="secondary" style={{ marginLeft: 16 }}>
                位置: ({(selectedObject as any).position?.x.toFixed(2)}, {(selectedObject as any).position?.y.toFixed(2)}, {(selectedObject as any).position?.z.toFixed(2)})
              </Text>
              <Text type="secondary" style={{ marginLeft: 16 }}>
                拖动以移动位置
              </Text>
            </div>
          )}
        </div>

        <div className="editor-sidebar">
          <Tabs activeKey={activeTab} onChange={setActiveTab} className="sidebar-tabs">
            <TabPane 
              tab={<span><BulbOutlined /> 灯具 ({lights.length})</span>} 
              key="lights"
            >
              <div className="sidebar-content">
                <div className="import-section">
                  <div className="import-section-title">导入灯具清单 CSV</div>
                  <Upload
                    accept=".csv"
                    customRequest={({ file }) => handleImportLights(file as File)}
                    showUploadList={false}
                  >
                    <Button icon={<ImportOutlined />} block>
                      选择 CSV 文件
                    </Button>
                  </Upload>
                </div>

                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  block 
                  onClick={() => setAddLightModal(true)}
                  style={{ marginBottom: 16 }}
                >
                  手动添加灯具
                </Button>

                <List
                  dataSource={lights}
                  renderItem={(light) => (
                    <List.Item
                      actions={[
                        <Popconfirm
                          title="确定删除此灯具吗？"
                          onConfirm={() => handleDeleteLight(light.id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <DeleteOutlined key="delete" style={{ color: '#ff4d4f' }} />
                        </Popconfirm>
                      ]}
                      onClick={() => setSelectedObject(light.id, 'light')}
                      style={{
                        cursor: 'pointer',
                        background: editor.selectedObjectId === light.id ? '#e6f7ff' : 'transparent',
                        borderRadius: 4,
                        padding: '8px 12px'
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Tag color={light.isHighTemp ? 'red' : 'blue'}>
                            {light.power}W
                          </Tag>
                        }
                        title={
                          <Space>
                            {light.name}
                            {light.isHighTemp && <Tag color="red" icon={<SafetyOutlined />}>高温</Tag>}
                            {editor.selectedObjectId === light.id && <Tag color="blue">选中</Tag>}
                          </Space>
                        }
                        description={
                          <Text type="secondary">
                            {light.type || '未知类型'} · {light.colorTemp}K · 
                            位置 ({light.position.x.toFixed(1)}, {light.position.y.toFixed(1)}, {light.position.z.toFixed(1)})
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            </TabPane>

            <TabPane 
              tab={<span><UserOutlined /> 演员 ({actors.length})</span>} 
              key="actors"
            >
              <div className="sidebar-content">
                <div className="import-section">
                  <div className="import-section-title">导入机位/演员 JSON</div>
                  <Upload
                    accept=".json"
                    customRequest={({ file }) => handleImportCameraActor(file as File)}
                    showUploadList={false}
                  >
                    <Button icon={<ImportOutlined />} block>
                      选择 JSON 文件
                    </Button>
                  </Upload>
                </div>

                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  block 
                  onClick={() => setAddActorModal(true)}
                  style={{ marginBottom: 16 }}
                >
                  手动添加演员
                </Button>

                <List
                  dataSource={actors}
                  renderItem={(actor) => (
                    <List.Item
                      actions={[
                        <Popconfirm
                          title="确定删除此演员吗？"
                          onConfirm={() => handleDeleteActor(actor.id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <DeleteOutlined key="delete" style={{ color: '#ff4d4f' }} />
                        </Popconfirm>
                      ]}
                      onClick={() => setSelectedObject(actor.id, 'actor')}
                      style={{
                        cursor: 'pointer',
                        background: editor.selectedObjectId === actor.id ? '#e6f7ff' : 'transparent',
                        borderRadius: 4,
                        padding: '8px 12px'
                      }}
                    >
                      <List.Item.Meta
                        avatar={<UserOutlined style={{ fontSize: 20 }} />}
                        title={
                          <Space>
                            {actor.name}
                            {actor.walkPath && actor.walkPath.length > 0 && (
                              <Tag color="green">有走位</Tag>
                            )}
                            {editor.selectedObjectId === actor.id && <Tag color="blue">选中</Tag>}
                          </Space>
                        }
                        description={
                          <Text type="secondary">
                            位置 ({actor.position.x.toFixed(1)}, {actor.position.z.toFixed(1)})
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            </TabPane>

            <TabPane 
              tab={<span><VideoCameraOutlined /> 机位 ({cameras.length})</span>} 
              key="cameras"
            >
              <div className="sidebar-content">
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  block 
                  onClick={() => setAddCameraModal(true)}
                  style={{ marginBottom: 16 }}
                >
                  添加机位
                </Button>

                <List
                  dataSource={cameras}
                  renderItem={(camera) => (
                    <List.Item
                      actions={[
                        <Popconfirm
                          title="确定删除此机位吗？"
                          onConfirm={() => handleDeleteCamera(camera.id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <DeleteOutlined key="delete" style={{ color: '#ff4d4f' }} />
                        </Popconfirm>
                      ]}
                      onClick={() => setSelectedObject(camera.id, 'camera')}
                      style={{
                        cursor: 'pointer',
                        background: editor.selectedObjectId === camera.id ? '#e6f7ff' : 'transparent',
                        borderRadius: 4,
                        padding: '8px 12px'
                      }}
                    >
                      <List.Item.Meta
                        avatar={<VideoCameraOutlined style={{ fontSize: 20 }} />}
                        title={
                          <Space>
                            {camera.name}
                            {editor.selectedObjectId === camera.id && <Tag color="blue">选中</Tag>}
                          </Space>
                        }
                        description={
                          <Text type="secondary">
                            {camera.lens} · {camera.fov}° · 
                            位置 ({camera.position.x.toFixed(1)}, {camera.position.z.toFixed(1)})
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            </TabPane>

            <TabPane 
              tab={<span><CalendarOutlined /> 日程 ({schedule.length})</span>} 
              key="schedule"
            >
              <div className="sidebar-content">
                <div className="import-section">
                  <div className="import-section-title">导入拍摄日程 JSON</div>
                  <Upload
                    accept=".json"
                    customRequest={({ file }) => handleImportSchedule(file as File)}
                    showUploadList={false}
                  >
                    <Button icon={<ImportOutlined />} block>
                      选择 JSON 文件
                    </Button>
                  </Upload>
                </div>

                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  block 
                  onClick={() => setAddScheduleModal(true)}
                  style={{ marginBottom: 16 }}
                >
                  手动添加场次
                </Button>

                <List
                  dataSource={[...schedule].sort((a, b) => {
                    if (a.date !== b.date) return a.date.localeCompare(b.date)
                    return a.startTime.localeCompare(b.startTime)
                  })}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Popconfirm
                          title="确定删除此场次吗？"
                          onConfirm={() => handleDeleteSchedule(item.id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <DeleteOutlined key="delete" style={{ color: '#ff4d4f' }} />
                        </Popconfirm>
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag>{item.date}</Tag>
                            <Text strong>{item.sceneName}</Text>
                          </Space>
                        }
                        description={
                          <div>
                            <Text type="secondary">
                              时间: {item.startTime} - {item.endTime}
                            </Text>
                            <br />
                            <Space size={[0, 8]} wrap>
                              {item.lightIds.length > 0 && <Tag color="blue">灯具: {item.lightIds.length}</Tag>}
                              {item.cameraIds.length > 0 && <Tag color="green">机位: {item.cameraIds.length}</Tag>}
                              {item.actorIds.length > 0 && <Tag color="orange">演员: {item.actorIds.length}</Tag>}
                            </Space>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            </TabPane>

            <TabPane 
              tab={
                <span>
                  <WarningOutlined /> 风险
                  {activeRisks.length > 0 && (
                    <Badge 
                      count={activeRisks.length} 
                      size="small" 
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </span>
              } 
              key="risks"
            >
              <div className="sidebar-content">
                <Button 
                  icon={<ReloadOutlined />} 
                  block 
                  onClick={calculateRisks}
                  style={{ marginBottom: 16 }}
                >
                  重新计算风险
                </Button>

                {activeRisks.length === 0 && overriddenRisks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                    <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
                    <div>暂无风险项</div>
                    <Text type="secondary">点击上方按钮进行风险检测</Text>
                  </div>
                ) : (
                  <>
                    {activeRisks.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <Title level={5} style={{ marginBottom: 12 }}>
                          <WarningOutlined style={{ color: '#ff4d4f' }} /> 未处理风险 ({activeRisks.length})
                        </Title>
                        {activeRisks.map((risk) => (
                          <div
                            key={risk.id}
                            className={`risk-item ${risk.severity}`}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <Tag color={getSeverityColor(risk.severity)} style={{ marginBottom: 8 }}>
                                  {getSeverityLabel(risk.severity)}
                                </Tag>
                                <Tag>{getTypeLabel(risk.type)}</Tag>
                                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                                  {risk.title}
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {risk.description}
                                </Text>
                              </div>
                              <Button
                                type="text"
                                icon={<CheckCircleOutlined />}
                                onClick={() => {
                                  setCurrentRisk(risk)
                                  setOverrideReason('')
                                  setOverrideModal(true)
                                }}
                                style={{ marginLeft: 8 }}
                              >
                                改判
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {overriddenRisks.length > 0 && (
                      <div>
                        <Title level={5} style={{ marginBottom: 12 }}>
                          <CloseCircleOutlined style={{ color: '#999' }} /> 已改判风险 ({overriddenRisks.length})
                        </Title>
                        {overriddenRisks.map((risk) => (
                          <div
                            key={risk.id}
                            className={`risk-item ${risk.severity} overridden`}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <Tag style={{ marginBottom: 8 }}>已改判</Tag>
                                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                                  {risk.title}
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  改判原因: {risk.overrideReason || '未说明'}
                                </Text>
                              </div>
                              <Button
                                type="text"
                                icon={<ReloadOutlined />}
                                onClick={() => {
                                  setCurrentRisk(risk)
                                  setOverrideReason('')
                                  setOverrideModal(true)
                                }}
                              >
                                恢复
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabPane>
          </Tabs>
        </div>
      </div>

      <Modal
        title="添加灯具"
        open={addLightModal}
        onOk={() => lightForm.submit()}
        onCancel={() => setAddLightModal(false)}
        okText="添加"
        cancelText="取消"
      >
        <Form
          form={lightForm}
          layout="vertical"
          onFinish={handleAddLight}
          initialValues={{
            power: 1000,
            colorTemp: 5600,
            standHeight: 2,
            isHighTemp: false
          }}
        >
          <Form.Item
            name="name"
            label="灯具名称"
            rules={[{ required: true, message: '请输入灯具名称' }]}
          >
            <Input placeholder="例如: 主灯 Key Light" />
          </Form.Item>

          <Form.Item
            name="type"
            label="灯具类型"
          >
            <Select placeholder="选择类型" allowClear>
              <Select.Option value="ARRI 1200W">ARRI 1200W</Select.Option>
              <Select.Option value="ARRI 650W">ARRI 650W</Select.Option>
              <Select.Option value="ARRI 300W">ARRI 300W</Select.Option>
              <Select.Option value="Kino Flo">Kino Flo</Select.Option>
              <Select.Option value="LED Panel">LED Panel</Select.Option>
              <Select.Option value="Softbox">Softbox</Select.Option>
              <Select.Option value="Umbrella">Umbrella</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="power"
            label="功率 (W)"
            rules={[{ required: true, message: '请输入功率' }]}
          >
            <InputNumber min={0} max={50000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="colorTemp"
            label="色温 (K)"
          >
            <Select>
              <Select.Option value={3200}>3200K (暖光/钨丝灯)</Select.Option>
              <Select.Option value={4300}>4300K (混合光)</Select.Option>
              <Select.Option value={5600}>5600K (日光)</Select.Option>
              <Select.Option value={6500}>6500K (冷光)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="standHeight"
            label="灯架高度 (m)"
          >
            <InputNumber min={0.5} max={5} step={0.1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="dmxChannel"
            label="DMX 通道"
          >
            <InputNumber min={1} max={512} style={{ width: '100%' }} placeholder="可选" />
          </Form.Item>

          <Form.Item
            name="isHighTemp"
            valuePropName="checked"
          >
            <Checkbox>高温灯具（如钨丝灯，有烫伤风险）</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加演员"
        open={addActorModal}
        onOk={() => actorForm.submit()}
        onCancel={() => setAddActorModal(false)}
        okText="添加"
        cancelText="取消"
      >
        <Form
          form={actorForm}
          layout="vertical"
          onFinish={handleAddActor}
          initialValues={{
            x: 0,
            z: 2,
            rotationY: 0
          }}
        >
          <Form.Item
            name="name"
            label="演员名称"
            rules={[{ required: true, message: '请输入演员名称' }]}
          >
            <Input placeholder="例如: 男主角、女主角、群演 A" />
          </Form.Item>

          <Form.Item label="初始位置">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="x" noStyle rules={[{ required: true }]}>
                <InputNumber placeholder="X" addonBefore="X" style={{ width: '50%' }} />
              </Form.Item>
              <Form.Item name="z" noStyle rules={[{ required: true }]}>
                <InputNumber placeholder="Z" addonBefore="Z" style={{ width: '50%' }} />
              </Form.Item>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="rotationY"
            label="朝向角度 (度)"
          >
            <InputNumber min={-180} max={180} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加机位"
        open={addCameraModal}
        onOk={() => cameraForm.submit()}
        onCancel={() => setAddCameraModal(false)}
        okText="添加"
        cancelText="取消"
      >
        <Form
          form={cameraForm}
          layout="vertical"
          onFinish={handleAddCamera}
          initialValues={{
            x: 0,
            z: -5,
            rotationY: 0,
            lens: '50mm',
            fov: 60
          }}
        >
          <Form.Item
            name="name"
            label="机位名称"
            rules={[{ required: true, message: '请输入机位名称' }]}
          >
            <Input placeholder="例如: 主机位、左机位、特写机位" />
          </Form.Item>

          <Form.Item label="位置">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="x" noStyle rules={[{ required: true }]}>
                <InputNumber placeholder="X" addonBefore="X" style={{ width: '50%' }} />
              </Form.Item>
              <Form.Item name="z" noStyle rules={[{ required: true }]}>
                <InputNumber placeholder="Z" addonBefore="Z" style={{ width: '50%' }} />
              </Form.Item>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="rotationY"
            label="朝向角度 (度)"
          >
            <InputNumber min={-180} max={180} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="lens"
            label="镜头"
          >
            <Select>
              <Select.Option value="14mm">14mm 广角</Select.Option>
              <Select.Option value="24mm">24mm 广角</Select.Option>
              <Select.Option value="35mm">35mm 标准</Select.Option>
              <Select.Option value="50mm">50mm 标准</Select.Option>
              <Select.Option value="85mm">85mm 中焦</Select.Option>
              <Select.Option value="135mm">135mm 长焦</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="fov"
            label="视角 (度)"
          >
            <InputNumber min={10} max={120} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加场次"
        open={addScheduleModal}
        onOk={() => scheduleForm.submit()}
        onCancel={() => setAddScheduleModal(false)}
        okText="添加"
        cancelText="取消"
      >
        <Form
          form={scheduleForm}
          layout="vertical"
          onFinish={handleAddSchedule}
        >
          <Form.Item
            name="sceneId"
            label="场次编号"
            rules={[{ required: true, message: '请输入场次编号' }]}
          >
            <Input placeholder="例如: Scene-001, A-01" />
          </Form.Item>

          <Form.Item
            name="sceneName"
            label="场次名称"
            rules={[{ required: true, message: '请输入场次名称' }]}
          >
            <Input placeholder="例如: 办公室内景、男主角特写" />
          </Form.Item>

          <Form.Item
            name="date"
            label="日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <Input type="date" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="时间">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="startTime" noStyle rules={[{ required: true }]}>
                <Input type="time" style={{ width: '50%' }} />
              </Form.Item>
              <Form.Item name="endTime" noStyle rules={[{ required: true }]}>
                <Input type="time" style={{ width: '50%' }} />
              </Form.Item>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="lightIds"
            label="使用灯具"
          >
            <Select
              mode="multiple"
              placeholder="选择灯具（可选）"
              options={lights.map(l => ({ label: l.name, value: l.id }))}
            />
          </Form.Item>

          <Form.Item
            name="cameraIds"
            label="使用机位"
          >
            <Select
              mode="multiple"
              placeholder="选择机位（可选）"
              options={cameras.map(c => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>

          <Form.Item
            name="actorIds"
            label="涉及演员"
          >
            <Select
              mode="multiple"
              placeholder="选择演员（可选）"
              options={actors.map(a => ({ label: a.name, value: a.id }))}
            />
          </Form.Item>

          <Form.Item
            name="notes"
            label="备注"
          >
            <Input.TextArea rows={2} placeholder="场次备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={currentRisk?.isOverridden ? '恢复风险' : '人工改判'}
        open={overrideModal}
        onOk={handleOverrideRisk}
        onCancel={() => {
          setOverrideModal(false)
          setCurrentRisk(null)
          setOverrideReason('')
        }}
        okText={currentRisk?.isOverridden ? '恢复' : '确认改判'}
        cancelText="取消"
      >
        {currentRisk && !currentRisk.isOverridden && (
          <Form layout="vertical">
            <Form.Item label="风险信息">
              <div style={{ 
                padding: 12, 
                background: '#fff1f0', 
                borderRadius: 4,
                borderLeft: `4px solid ${getSeverityColor(currentRisk.severity)}`
              }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  {currentRisk.title}
                </div>
                <Text type="secondary">{currentRisk.description}</Text>
              </div>
            </Form.Item>
            <Form.Item label="改判原因" required>
              <Input.TextArea
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="请说明改判原因..."
              />
            </Form.Item>
          </Form>
        )}
        {currentRisk?.isOverridden && (
          <div>
            <p>确定要恢复此风险吗？恢复后将重新显示在风险列表中。</p>
            <div style={{ 
              padding: 12, 
              background: '#f5f5f5', 
              borderRadius: 4,
              marginBottom: 16
            }}>
              <div style={{ fontWeight: 500 }}>{currentRisk.title}</div>
              <Text type="secondary">原改判原因: {currentRisk.overrideReason || '未说明'}</Text>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
