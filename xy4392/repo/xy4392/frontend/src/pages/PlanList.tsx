import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Card, 
  Button, 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  message, 
  Row, 
  Col, 
  Popconfirm,
  Empty,
  Spin
} from 'antd'
import { 
  PlusOutlined, 
  DeleteOutlined, 
  EditOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
  BulbOutlined
} from '@ant-design/icons'
import { planApi } from '@/services/api'
import { LightingPlan } from '@/types'

export default function PlanList() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<LightingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingPlan, setEditingPlan] = useState<LightingPlan | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  const loadPlans = async () => {
    setLoading(true)
    try {
      const res = await planApi.getAll()
      if (res.success) {
        setPlans(res.data || [])
      }
    } catch (error) {
      message.error('加载方案列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlans()
  }, [])

  const handleCreate = async (values: any) => {
    try {
      const res = await planApi.create({
        name: values.name,
        description: values.description || '',
        studioDimensions: {
          width: values.width,
          depth: values.depth,
          height: values.height
        },
        maxPowerLimit: values.maxPowerLimit
      })
      if (res.success) {
        message.success('创建成功')
        setCreateModalVisible(false)
        form.resetFields()
        loadPlans()
      }
    } catch (error) {
      message.error('创建失败')
    }
  }

  const handleEdit = async (values: any) => {
    if (!editingPlan) return
    try {
      const res = await planApi.update(editingPlan.id, {
        name: values.name,
        description: values.description,
        studioDimensions: {
          width: values.width,
          depth: values.depth,
          height: values.height
        },
        maxPowerLimit: values.maxPowerLimit
      })
      if (res.success) {
        message.success('更新成功')
        setEditModalVisible(false)
        setEditingPlan(null)
        loadPlans()
      }
    } catch (error) {
      message.error('更新失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await planApi.delete(id)
      if (res.success) {
        message.success('删除成功')
        loadPlans()
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  const openEditModal = (plan: LightingPlan) => {
    setEditingPlan(plan)
    editForm.setFieldsValue({
      name: plan.name,
      description: plan.description,
      width: plan.studioDimensions.width,
      depth: plan.studioDimensions.depth,
      height: plan.studioDimensions.height,
      maxPowerLimit: plan.maxPowerLimit
    })
    setEditModalVisible(true)
  }

  const getPowerStatus = (total: number, max: number) => {
    const ratio = total / max
    if (ratio > 1) return { color: '#ff4d4f', text: '超载' }
    if (ratio > 0.8) return { color: '#faad14', text: '警告' }
    return { color: '#52c41a', text: '正常' }
  }

  return (
    <div className="plan-list-page">
      <div className="plan-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>🎬 摄影棚布光预演工具</h1>
          <p>专业的 3D 布光方案设计与风险评估系统</p>
        </div>
        <Button 
          type="primary" 
          size="large" 
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          新建方案
        </Button>
      </div>

      <Spin spinning={loading}>
        {plans.length > 0 ? (
          <Row gutter={[24, 24]}>
            {plans.map(plan => {
              const powerStatus = getPowerStatus(plan.totalPower, plan.maxPowerLimit)
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={plan.id}>
                  <Card
                    hoverable
                    onClick={() => navigate(`/editor/${plan.id}`)}
                    actions={[
                      <EditOutlined 
                        key="edit" 
                        onClick={(e) => { e.stopPropagation(); openEditModal(plan) }} 
                      />,
                      <Popconfirm
                        title="确定删除此方案吗？"
                        onConfirm={(e) => { e?.stopPropagation(); handleDelete(plan.id) }}
                        onCancel={(e) => e?.stopPropagation()}
                        okText="确定"
                        cancelText="取消"
                      >
                        <DeleteOutlined 
                          key="delete"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    ]}
                  >
                    <Card.Meta
                      title={<span style={{ fontSize: 16, fontWeight: 600 }}>{plan.name}</span>}
                      description={
                        <div style={{ marginTop: 12 }}>
                          <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>
                            {plan.description || '暂无描述'}
                          </p>
                          <div style={{ 
                            marginTop: 12, 
                            paddingTop: 12, 
                            borderTop: '1px solid #f0f0f0',
                            fontSize: 12,
                            color: '#888'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <BulbOutlined />
                              <span>{plan.studioDimensions.width}m × {plan.studioDimensions.depth}m × {plan.studioDimensions.height}m</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ThunderboltOutlined style={{ color: powerStatus.color }} />
                                <span>{plan.totalPower}W / {plan.maxPowerLimit}W</span>
                              </div>
                              <span style={{ color: powerStatus.color }}>{powerStatus.text}</span>
                            </div>
                          </div>
                        </div>
                      }
                    />
                  </Card>
                </Col>
              )
            })}
          </Row>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty
              description="暂无布光方案"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建第一个方案
              </Button>
            </Empty>
          </div>
        )}
      </Spin>

      <Modal
        title="新建布光方案"
        open={createModalVisible}
        onOk={() => form.submit()}
        onCancel={() => { setCreateModalVisible(false); form.resetFields() }}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{
            width: 10,
            depth: 8,
            height: 4,
            maxPowerLimit: 5000
          }}
        >
          <Form.Item
            name="name"
            label="方案名称"
            rules={[{ required: true, message: '请输入方案名称' }]}
          >
            <Input placeholder="例如：产品宣传广告拍摄" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={2} placeholder="方案描述（可选）" />
          </Form.Item>

          <Form.Item label="影棚尺寸（米）">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="width" noStyle rules={[{ required: true, message: '必填' }]}>
                  <InputNumber min={1} max={50} placeholder="宽" style={{ width: '100%' }} addonAfter="宽" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="depth" noStyle rules={[{ required: true, message: '必填' }]}>
                  <InputNumber min={1} max={50} placeholder="深" style={{ width: '100%' }} addonAfter="深" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="height" noStyle rules={[{ required: true, message: '必填' }]}>
                  <InputNumber min={1} max={20} placeholder="高" style={{ width: '100%' }} addonAfter="高" />
                </Form.Item>
              </Col>
            </Row>
          </Form.Item>

          <Form.Item
            name="maxPowerLimit"
            label="最大电功率限制（瓦）"
            rules={[{ required: true, message: '请输入功率限制' }]}
          >
            <InputNumber min={1000} max={50000} style={{ width: '100%' }} addonAfter="W" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑方案"
        open={editModalVisible}
        onOk={() => editForm.submit()}
        onCancel={() => { setEditModalVisible(false); setEditingPlan(null) }}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEdit}
        >
          <Form.Item
            name="name"
            label="方案名称"
            rules={[{ required: true, message: '请输入方案名称' }]}
          >
            <Input placeholder="方案名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={2} placeholder="方案描述" />
          </Form.Item>

          <Form.Item label="影棚尺寸（米）">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="width" noStyle rules={[{ required: true, message: '必填' }]}>
                  <InputNumber min={1} max={50} style={{ width: '100%' }} addonAfter="宽" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="depth" noStyle rules={[{ required: true, message: '必填' }]}>
                  <InputNumber min={1} max={50} style={{ width: '100%' }} addonAfter="深" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="height" noStyle rules={[{ required: true, message: '必填' }]}>
                  <InputNumber min={1} max={20} style={{ width: '100%' }} addonAfter="高" />
                </Form.Item>
              </Col>
            </Row>
          </Form.Item>

          <Form.Item
            name="maxPowerLimit"
            label="最大电功率限制（瓦）"
            rules={[{ required: true, message: '请输入功率限制' }]}
          >
            <InputNumber min={1000} max={50000} style={{ width: '100%' }} addonAfter="W" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
