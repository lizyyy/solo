import React, { useEffect, useState } from 'react'
import {
  Table,
  Input,
  Button,
  Space,
  Modal,
  Form,
  InputNumber,
  Select,
  message,
  Tag,
  Drawer,
  Descriptions,
  Steps,
  Card,
  Statistic,
  Row,
  Col,
  Typography,
  Divider,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExportOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { ipc } from '../ipc'
import { authStore } from '../store/authStore'
import type { InventoryTask, TaskStatus, Product, TaskStatistics } from '../../types'

const { Text } = Typography

const statusMap: Record<TaskStatus, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: 'default' },
  IN_PROGRESS: { label: '进行中', color: 'processing' },
  PENDING_APPROVAL: { label: '待审批', color: 'warning' },
  APPROVED: { label: '已通过', color: 'success' },
  REJECTED: { label: '已拒绝', color: 'error' },
  CANCELLED: { label: '已取消', color: 'default' },
}

const stepOrder: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED']

function TasksPage() {
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState<InventoryTask[]>([])
  const [total, setTotal] = useState(0)
  const [users, setUsers] = useState<any[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>()
  const [keyword, setKeyword] = useState('')

  const [createVisible, setCreateVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentTask, setCurrentTask] = useState<InventoryTask | null>(null)
  const [taskDetail, setTaskDetail] = useState<any>(null)
  const [taskStats, setTaskStats] = useState<TaskStatistics | null>(null)
  const [taskHistory, setTaskHistory] = useState<any[]>([])

  const [createForm] = Form.useForm()
  const [recordForm] = Form.useForm()
  const [recordVisible, setRecordVisible] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (statusFilter) params.status = statusFilter
      if (keyword) params.keyword = keyword

      const [taskResult, userResult, productResult] = await Promise.all([
        ipc.task.listTasks(params),
        ipc.auth.listUsers(),
        ipc.inventory.listProducts({ take: 1000 }),
      ])

      if (taskResult.success) {
        setTasks(taskResult.data.tasks)
        setTotal(taskResult.data.total)
      }
      if (userResult.success) {
        setUsers(userResult.data)
      }
      if (productResult.success) {
        setProducts(productResult.data.products)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSearch = () => loadData()

  const handleCreate = async (values: any) => {
    try {
      const result = await ipc.task.create({
        ...values,
        userId: authStore.currentUser?.id!,
      })
      if (result.success) {
        message.success('任务创建成功')
        setCreateVisible(false)
        createForm.resetFields()
        loadData()
      } else {
        message.error(result.error)
      }
    } catch (err) {
      message.error('创建失败')
    }
  }

  const handleStatusChange = async (task: InventoryTask, newStatus: TaskStatus, remark?: string) => {
    try {
      const result = await ipc.task.updateStatus({
        taskId: task.id,
        newStatus,
        remark,
        userId: authStore.currentUser?.id!,
      })
      if (result.success) {
        message.success('状态已更新')
        loadData()
        if (taskDetail?.id === task.id) {
          loadTaskDetail(task.id)
        }
      } else {
        message.error(result.error)
      }
    } catch (err: any) {
      message.error(err.message)
    }
  }

  const loadTaskDetail = async (taskId: string) => {
    const [detailResult, statsResult, historyResult] = await Promise.all([
      ipc.task.getById(taskId),
      ipc.task.getStatistics(taskId),
      ipc.task.getHistory(taskId),
    ])

    if (detailResult.success) setTaskDetail(detailResult.data)
    if (statsResult.success) setTaskStats(statsResult.data)
    if (historyResult.success) setTaskHistory(historyResult.data)
  }

  const showDetail = async (task: InventoryTask) => {
    setCurrentTask(task)
    setDetailVisible(true)
    await loadTaskDetail(task.id)
  }

  const handleAddRecord = async (values: any) => {
    if (!currentTask || !selectedProduct) return
    try {
      const result = await ipc.task.addRecord({
        taskId: currentTask.id,
        productId: selectedProduct.id,
        userId: authStore.currentUser?.id!,
        expectedQty: values.expectedQty,
        actualQty: values.actualQty,
        remark: values.remark,
      })
      if (result.success) {
        message.success('记录已添加')
        setRecordVisible(false)
        loadTaskDetail(currentTask.id)
      } else {
        message.error(result.error)
      }
    } catch (err) {
      message.error('添加失败')
    }
  }

  const handleExport = async () => {
    if (!currentTask) return
    const dialog = await ipc.export.saveDialog()
    if (!dialog.success || dialog.data?.canceled || !dialog.data?.filePath) return

    const filePath = dialog.data.filePath.endsWith('.xlsx') ? dialog.data.filePath : dialog.data.filePath + '.xlsx'
    const result = await ipc.export.taskRecords(currentTask.id, filePath)

    if (result.success) {
      message.success(`已导出 ${result.data.count} 条记录`)
    } else {
      message.error(result.error)
    }
  }

  const getNextAllowedStatuses = (current: TaskStatus): TaskStatus[] => {
    switch (current) {
      case 'PENDING': return ['IN_PROGRESS', 'CANCELLED']
      case 'IN_PROGRESS': return ['PENDING_APPROVAL', 'CANCELLED']
      case 'PENDING_APPROVAL': return ['APPROVED', 'REJECTED', 'IN_PROGRESS']
      case 'REJECTED': return ['IN_PROGRESS', 'CANCELLED']
      default: return []
    }
  }

  const columns = [
    { title: '任务名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '描述', dataIndex: 'description', key: 'description', width: 250,
      render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: TaskStatus) => <Tag color={statusMap[v].color}>{statusMap[v].label}</Tag> },
    { title: '责任人', key: 'assignee', width: 100,
      render: (_: any, r: InventoryTask) => r.assignee?.name || '-' },
    { title: '记录数', key: 'recordCount', width: 80,
      render: (_: any, r: InventoryTask) => r._count?.records || 0 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180,
      render: (v: string) => new Date(v).toLocaleString() },
    { title: '操作', key: 'action', width: 280,
      render: (_: any, r: InventoryTask) => {
        const nextStatuses = getNextAllowedStatuses(r.status)
        return (
          <Space size="small">
            <Button size="small" icon={<EyeOutlined />} onClick={() => showDetail(r)}>详情</Button>
            {nextStatuses.includes('IN_PROGRESS') && (
              <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStatusChange(r, 'IN_PROGRESS', '开始执行')}>开始</Button>
            )}
            {nextStatuses.includes('PENDING_APPROVAL') && (
              <Button size="small" icon={<PauseCircleOutlined />} onClick={() => handleStatusChange(r, 'PENDING_APPROVAL', '提交审核')}>提交</Button>
            )}
            {authStore.isAdmin && nextStatuses.includes('APPROVED') && (
              <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleStatusChange(r, 'APPROVED', '审批通过')}>通过</Button>
            )}
            {authStore.isAdmin && nextStatuses.includes('REJECTED') && (
              <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleStatusChange(r, 'REJECTED', '审批拒绝')}>拒绝</Button>
            )}
          </Space>
        )
      }
    },
  ]

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索任务名称"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            style={{ width: 130 }}
          >
            {(Object.keys(statusMap) as TaskStatus[]).map(s => (
              <Select.Option key={s} value={s}>{statusMap[s].label}</Select.Option>
            ))}
          </Select>
          <Button type="primary" onClick={handleSearch}>搜索</Button>
          <Button icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>新建任务</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={tasks}
        loading={loading}
        pagination={{ total, pageSize: 20 }}
      />

      <Modal
        title="新建盘点任务"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => createForm.submit()}
        width={500}
      >
        <Form layout="vertical" form={createForm} onFinish={handleCreate}>
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input placeholder="例如：1月第一周盘点任务" />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <Input.TextArea rows={3} placeholder="任务的详细说明" />
          </Form.Item>
          <Form.Item name="assigneeId" label="责任人">
            <Select placeholder="选择责任人" allowClear>
              {users.map(u => (
                <Select.Option key={u.id} value={u.id}>{u.name} ({u.role === 'ADMIN' ? '管理员' : '盘点员'})</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="任务详情"
        width={900}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        extra={
          <Space>
            <Button icon={<ExportOutlined />} onClick={handleExport}>导出记录</Button>
            {currentTask?.status === 'IN_PROGRESS' && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                setRecordVisible(true)
              }}>添加盘点记录</Button>
            )}
          </Space>
        }
      >
        {taskDetail && (
          <div>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="任务名称">{taskDetail.name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusMap[taskDetail.status as keyof typeof statusMap].color}>
                  {statusMap[taskDetail.status as keyof typeof statusMap].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="责任人">{taskDetail.assignee?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{taskDetail.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{taskDetail.startedAt ? new Date(taskDetail.startedAt).toLocaleString() : '-'}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{taskDetail.completedAt ? new Date(taskDetail.completedAt).toLocaleString() : '-'}</Descriptions.Item>
            </Descriptions>

            <Divider>状态流转</Divider>
            <Steps
              current={stepOrder.indexOf(taskDetail.status)}
              items={stepOrder.map(s => ({
                title: statusMap[s].label,
              }))}
            />

            {taskStats && (
              <>
                <Divider>盘点统计</Divider>
                <Row gutter={16}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="总记录数" value={taskStats.total} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="账实相符" value={taskStats.matched} valueStyle={{ color: '#52c41a' }} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="盘盈" value={taskStats.positiveDiff} valueStyle={{ color: '#1890ff' }} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="盘亏" value={taskStats.negativeDiff} valueStyle={{ color: '#ff4d4f' }} />
                    </Card>
                  </Col>
                </Row>
              </>
            )}

            <Divider>盘点记录</Divider>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'SKU', dataIndex: ['product', 'sku'], width: 100 },
                { title: '商品', dataIndex: ['product', 'name'], width: 180 },
                { title: '账面数量', dataIndex: 'expectedQty', width: 100, align: 'right' },
                { title: '实际数量', dataIndex: 'actualQty', width: 100, align: 'right' },
                { title: '差异', dataIndex: 'difference', width: 80, align: 'right',
                  render: (v: number) => (
                    <Text strong style={{ color: v === 0 ? '#52c41a' : v > 0 ? '#1890ff' : '#ff4d4f' }}>
                      {v > 0 ? '+' : ''}{v}
                    </Text>
                  )
                },
                { title: '盘点人', dataIndex: ['user', 'name'], width: 80 },
                { title: '备注', dataIndex: 'remark', width: 120, render: (v: string) => v || '-' },
              ]}
              dataSource={taskDetail.records || []}
            />

            <Divider>状态变更历史</Divider>
            {taskHistory.length > 0 ? (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: '时间', dataIndex: 'changedAt', width: 180,
                    render: (v: string) => new Date(v).toLocaleString() },
                  { title: '变更人', dataIndex: 'changedBy', width: 120,
                    render: (id: string) => users.find(u => u.id === id)?.name || id },
                  { title: '旧状态', dataIndex: 'oldStatus', width: 100,
                    render: (v: TaskStatus) => v ? <Tag>{statusMap[v]?.label}</Tag> : '无' },
                  { title: '新状态', dataIndex: 'newStatus', width: 100,
                    render: (v: TaskStatus) => <Tag color={statusMap[v]?.color}>{statusMap[v]?.label}</Tag> },
                  { title: '备注', dataIndex: 'remark', render: (v: string) => v || '-' },
                ]}
                dataSource={taskHistory}
              />
            ) : (
              <Text type="secondary">暂无历史记录</Text>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        title="添加盘点记录"
        open={recordVisible}
        onCancel={() => {
          setRecordVisible(false)
          recordForm.resetFields()
          setSelectedProduct(null)
        }}
        onOk={() => recordForm.submit()}
        width={500}
      >
        <Form layout="vertical" form={recordForm} onFinish={handleAddRecord}>
          <Form.Item name="productId" label="选择商品" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="搜索或选择商品"
              optionFilterProp="children"
              onChange={(value) => {
                const product = products.find(p => p.id === value)
                setSelectedProduct(product || null)
                if (product?.inventory) {
                  recordForm.setFieldsValue({ expectedQty: product.inventory.quantity })
                }
              }}
            >
              {products.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.sku} - {p.name} (库存: {p.inventory?.quantity || 0})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="expectedQty" label="账面数量" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="actualQty" label="实际盘点数量" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TasksPage
