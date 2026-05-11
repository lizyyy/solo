import { useState } from 'react'
import dayjs from 'dayjs'
import {
  Table, Button, Modal, Form, Input, Select, DatePicker, TimePicker,
  Space, Tag, Popconfirm, message, Card, Row, Col, Statistic, Alert, Descriptions,
  Tooltip,
} from 'antd'
import {
  PlusOutlined, EyeOutlined, CheckCircleOutlined, PlayCircleOutlined,
  StopOutlined, RollbackOutlined, DeleteOutlined, DownloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { Reservation, ReservationStatus, ReservationConflict } from '@/types'
import { useStore } from '@/store'
import { exportReservations } from '@/utils/export'
import { hasAnyConflict } from '@/utils/conflict'

const statusOptions: { value: ReservationStatus; label: string; color: string }[] = [
  { value: 'pending', label: '待确认', color: 'gold' },
  { value: 'confirmed', label: '已确认', color: 'blue' },
  { value: 'in_progress', label: '进行中', color: 'processing' },
  { value: 'completed', label: '已完成', color: 'success' },
  { value: 'cancelled', label: '已取消', color: 'default' },
  { value: 'rescheduled', label: '已改约', color: 'purple' },
]

const sourceOptions = [
  { value: '线上', label: '线上（官网/小程序）' },
  { value: '到店', label: '到店咨询' },
  { value: '转介绍', label: '客户转介绍' },
  { value: '其他', label: '其他渠道' },
]

const routeOptions = [
  { value: '市区路线（15km）', label: '市区路线（15km）' },
  { value: '高速路线（25km）', label: '高速路线（25km）' },
  { value: '综合路线（20km）', label: '综合路线（20km）' },
  { value: '自定义', label: '自定义路线' },
]

function ReservationManagement() {
  const reservations = useStore(state => state.reservations)
  const vehicles = useStore(state => state.vehicles)
  const consultants = useStore(state => state.consultants)
  const createReservation = useStore(state => state.createReservation)
  const updateReservationStatus = useStore(state => state.updateReservationStatus)
  const rescheduleReservation = useStore(state => state.rescheduleReservation)
  const deleteReservation = useStore(state => state.deleteReservation)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
  const [viewingReservation, setViewingReservation] = useState<Reservation | null>(null)
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all')
  const [conflictFilter, setConflictFilter] = useState<'all' | 'has' | 'none'>('all')
  const [createForm] = Form.useForm()
  const [rescheduleForm] = Form.useForm()

  const availableVehicles = vehicles.filter(v => v.isAvailable)
  const availableConsultants = consultants.filter(c => c.isActive)

  const filteredReservations = reservations
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => {
      if (conflictFilter === 'all') return true
      if (conflictFilter === 'has') return !!r.conflictInfo
      return !r.conflictInfo
    })
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const handleCreate = () => {
    createForm.resetFields()
    createForm.setFieldsValue({
      startTime: '10:00',
      endTime: '11:00',
      testDriveRoute: routeOptions[0].value,
    })
    setCreateModalOpen(true)
  }

  const handleSubmitCreate = () => {
    createForm.validateFields().then(values => {
      const result = createReservation({
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        vehicleId: values.vehicleId,
        consultantId: values.consultantId,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime,
        endTime: values.endTime,
        testDriveRoute: values.testDriveRoute,
        source: values.source,
        notes: values.notes,
      })

      if (result.duplicate) {
        message.error(result.conflict.details[0])
        return
      }

      if (hasAnyConflict(result.conflict)) {
        Modal.warning({
          title: '预约存在冲突，已标记为待确认',
          content: (
            <div>
              {result.conflict.details.map((d, i) => (
                <div key={i} style={{ color: '#ff4d4f', marginTop: 4 }}>
                  <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                  {d}
                </div>
              ))}
            </div>
          ),
        })
      } else {
        message.success('预约创建成功，已确认')
      }
      setCreateModalOpen(false)
    })
  }

  const handleViewDetail = (r: Reservation) => {
    setViewingReservation(r)
    setDetailModalOpen(true)
  }

  const handleStatusChange = (r: Reservation, newStatus: ReservationStatus) => {
    const result = updateReservationStatus(r.id, newStatus)
    if (!result.success) {
      if (result.conflict) {
        Modal.error({
          title: '状态推进失败，仍存在冲突',
          content: (
            <div>
              {result.conflict.details.map((d, i) => (
                <div key={i} style={{ color: '#ff4d4f', marginTop: 4 }}>
                  <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                  {d}
                </div>
              ))}
            </div>
          ),
        })
      }
      return
    }

    const labels: Record<ReservationStatus, string> = {
      pending: '待确认', confirmed: '已确认', in_progress: '进行中',
      completed: '已完成', cancelled: '已取消', rescheduled: '已改约',
    }
    message.success(`状态已更新为「${labels[newStatus]}」`)
  }

  const handleOpenReschedule = (r: Reservation) => {
    setViewingReservation(r)
    rescheduleForm.resetFields()
    rescheduleForm.setFieldsValue({
      date: dayjs(r.date),
      startTime: r.startTime,
      endTime: r.endTime,
    })
    setRescheduleModalOpen(true)
  }

  const handleReschedule = () => {
    if (!viewingReservation) return
    rescheduleForm.validateFields().then(values => {
      const result = rescheduleReservation(viewingReservation.id, {
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime,
        endTime: values.endTime,
      })

      if (result.conflict && hasAnyConflict(result.conflict)) {
        Modal.warning({
          title: '改约后仍存在冲突，状态保持待确认',
          content: (
            <div>
              {result.conflict.details.map((d, i) => (
                <div key={i} style={{ color: '#ff4d4f', marginTop: 4 }}>
                  <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                  {d}
                </div>
              ))}
            </div>
          ),
        })
      } else {
        message.success('改约成功，状态已确认')
      }
      setRescheduleModalOpen(false)
    })
  }

  const renderConflictTag = (conflict?: ReservationConflict) => {
    if (!conflict) return <Tag color="success">无冲突</Tag>
    const parts = []
    if (conflict.vehicleConflict) parts.push('车辆')
    if (conflict.consultantConflict) parts.push('顾问')
    if (conflict.chargeConflict) parts.push('充电')
    return (
      <Tooltip title={conflict.details.join('；')}>
        <Tag color="red" icon={<ExclamationCircleOutlined />}>
          冲突：{parts.join('+')}
        </Tag>
      </Tooltip>
    )
  }

  const columns = [
    {
      title: '客户',
      key: 'customer',
      width: 150,
      render: (_: unknown, r: Reservation) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.customerName}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{r.customerPhone}</div>
        </div>
      ),
    },
    {
      title: '车辆',
      dataIndex: 'vehicleId',
      key: 'vehicleId',
      width: 180,
      render: (id: string) => {
        const v = vehicles.find(item => item.id === id)
        return v ? `${v.brand} ${v.model} (${v.licensePlate})` : '已删除'
      },
    },
    {
      title: '顾问',
      dataIndex: 'consultantId',
      key: 'consultantId',
      width: 100,
      render: (id: string) => {
        const c = consultants.find(item => item.id === id)
        return c?.name ?? '已删除'
      },
    },
    {
      title: '日期时间',
      key: 'datetime',
      width: 180,
      render: (_: unknown, r: Reservation) => (
        <div>
          <div>{r.date}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{r.startTime} - {r.endTime}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: ReservationStatus) => {
        const opt = statusOptions.find(o => o.value === s)
        return <Tag color={opt?.color}>{opt?.label}</Tag>
      },
    },
    {
      title: '冲突',
      key: 'conflict',
      width: 140,
      render: (_: unknown, r: Reservation) => renderConflictTag(r.conflictInfo),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right' as const,
      width: 320,
      render: (_: unknown, r: Reservation) => {
        const canConfirm = r.status === 'pending'
        const canStart = r.status === 'confirmed'
        const canComplete = r.status === 'in_progress'
        const canCancel = ['pending', 'confirmed'].includes(r.status)
        const canReschedule = ['pending', 'confirmed'].includes(r.status)

        return (
          <Space size={[4, 4]} wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>
              详情
            </Button>
            {canConfirm && (
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleStatusChange(r, 'confirmed')}
              >
                确认
              </Button>
            )}
            {canStart && (
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStatusChange(r, 'in_progress')}
              >
                开始
              </Button>
            )}
            {canComplete && (
              <Button
                type="link"
                size="small"
                icon={<StopOutlined />}
                onClick={() => handleStatusChange(r, 'completed')}
              >
                完成
              </Button>
            )}
            {canReschedule && (
              <Button
                type="link"
                size="small"
                icon={<RollbackOutlined />}
                onClick={() => handleOpenReschedule(r)}
              >
                改约
              </Button>
            )}
            {canCancel && (
              <Popconfirm
                title="确定取消此预约？"
                onConfirm={() => handleStatusChange(r, 'cancelled')}
              >
                <Button type="link" size="small" danger>
                  取消
                </Button>
              </Popconfirm>
            )}
            <Popconfirm title="确定删除？" onConfirm={() => deleteReservation(r.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  const statsByStatus = statusOptions.map(opt => ({
    ...opt,
    count: reservations.filter(r => r.status === opt.value).length,
  }))

  const conflictCount = reservations.filter(r => r.conflictInfo).length

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总预约" value={reservations.length} />
          </Card>
        </Col>
        {statsByStatus.slice(0, 5).map(opt => (
          <Col span={4} key={opt.value}>
            <Card size="small">
              <Statistic
                title={opt.label}
                value={opt.count}
                valueStyle={{ color: opt.color === 'default' ? '#999' : undefined }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {conflictCount > 0 && (
        <Alert
          message={`当前有 ${conflictCount} 条预约存在冲突，需要人工复核`}
          type="warning"
          showIcon
          action={
            <Button size="small" type="primary" onClick={() => setConflictFilter('has')}>
              查看冲突
            </Button>
          }
        />
      )}

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            disabled={availableVehicles.length === 0 || availableConsultants.length === 0}
          >
            新增预约
          </Button>

          {(availableVehicles.length === 0 || availableConsultants.length === 0) && (
            <span style={{ color: '#999' }}>
              请先确保有可用的车辆和在职顾问
            </span>
          )}

          <span style={{ marginLeft: 24 }}>状态筛选：</span>
          <Select
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: '全部' },
              ...statusOptions.map(o => ({ value: o.value, label: o.label })),
            ]}
          />

          <span>冲突筛选：</span>
          <Select
            style={{ width: 120 }}
            value={conflictFilter}
            onChange={setConflictFilter}
            options={[
              { value: 'all', label: '全部' },
              { value: 'has', label: '有冲突' },
              { value: 'none', label: '无冲突' },
            ]}
          />

          <Button
            icon={<DownloadOutlined />}
            onClick={() => Modal.confirm({
              title: '导出格式',
              okText: 'Excel',
              cancelText: 'CSV',
              onOk: () => exportReservations(filteredReservations, vehicles, consultants, 'xlsx'),
              onCancel: () => { exportReservations(filteredReservations, vehicles, consultants, 'csv'); return Promise.resolve(true) },
            })}
            disabled={filteredReservations.length === 0}
          >
            导出
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredReservations}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="新增预约"
        open={createModalOpen}
        onOk={handleSubmitCreate}
        onCancel={() => setCreateModalOpen(false)}
        destroyOnClose
        width={600}
        okText="提交预约"
      >
        <Alert
          message="提交时将自动检测：车辆冲突、顾问排班冲突、充电状态冲突"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customerName" label="客户姓名" rules={[{ required: true }]}>
                <Input placeholder="请输入姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customerPhone"
                label="客户电话"
                rules={[
                  { required: true, message: '请输入电话' },
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
                ]}
              >
                <Input placeholder="用于重复提交检测" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="vehicleId" label="选择车辆" rules={[{ required: true }]}>
                <Select
                  placeholder="选择试驾车"
                  options={availableVehicles.map(v => ({
                    value: v.id,
                    label: `${v.brand} ${v.model} (${v.licensePlate}) - 电量${v.currentBattery}%`,
                    disabled: v.chargeStatus === 'out_of_service',
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="consultantId" label="选择顾问" rules={[{ required: true }]}>
                <Select
                  placeholder="选择销售顾问"
                  options={availableConsultants.map(c => ({
                    value: c.id,
                    label: c.name + (c.specialty ? ` - ${c.specialty}` : ''),
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="date" label="日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="startTime" label="开始时间" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="endTime" label="结束时间" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="testDriveRoute" label="试驾路线" rules={[{ required: true }]}>
            <Select options={routeOptions} />
          </Form.Item>
          <Form.Item
            name="source"
            label="来源"
            rules={[{ required: true, message: '请选择来源，避免来源记录缺失' }]}
          >
            <Select options={sourceOptions} placeholder="必填：选择来源渠道" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="预约详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        {viewingReservation && (() => {
          const v = vehicles.find(item => item.id === viewingReservation.vehicleId)
          const c = consultants.find(item => item.id === viewingReservation.consultantId)
          const statusOpt = statusOptions.find(o => o.value === viewingReservation.status)
          return (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="客户">{viewingReservation.customerName}</Descriptions.Item>
                <Descriptions.Item label="电话">{viewingReservation.customerPhone}</Descriptions.Item>
                <Descriptions.Item label="车辆">
                  {v ? `${v.brand} ${v.model} (${v.licensePlate})` : '已删除'}
                </Descriptions.Item>
                <Descriptions.Item label="顾问">{c?.name ?? '已删除'}</Descriptions.Item>
                <Descriptions.Item label="日期">{viewingReservation.date}</Descriptions.Item>
                <Descriptions.Item label="时间">
                  {viewingReservation.startTime} - {viewingReservation.endTime}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusOpt?.color}>{statusOpt?.label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="来源">{viewingReservation.source}</Descriptions.Item>
                <Descriptions.Item label="试驾路线" span={2}>
                  {viewingReservation.testDriveRoute}
                </Descriptions.Item>
              </Descriptions>

              {viewingReservation.conflictInfo && (
                <Alert
                  message="存在冲突，需要复核"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {viewingReservation.conflictInfo.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  }
                  type="error"
                  showIcon
                />
              )}

              {viewingReservation.notes && (
                <Descriptions bordered column={1}>
                  <Descriptions.Item label="备注">{viewingReservation.notes}</Descriptions.Item>
                </Descriptions>
              )}

              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="创建时间">
                  {dayjs(viewingReservation.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {dayjs(viewingReservation.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              </Descriptions>
            </Space>
          )
        })()}
      </Modal>

      <Modal
        title="改约（将重新检测冲突）"
        open={rescheduleModalOpen}
        onOk={handleReschedule}
        onCancel={() => setRescheduleModalOpen(false)}
        destroyOnClose
      >
        <Alert
          message="改约后系统会重新检测车辆、顾问排班、充电状态冲突"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={rescheduleForm} layout="vertical">
          <Form.Item name="date" label="新日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startTime" label="新开始时间" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label="新结束时间" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  )
}

export default ReservationManagement
