import { useState } from 'react'
import dayjs from 'dayjs'
import {
  Table, Button, Modal, Form, Select,
  Space, Tag, Popconfirm, message, Card, Row, Col, Statistic, DatePicker, TimePicker,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ScheduleOutlined,
} from '@ant-design/icons'
import type { ConsultantSchedule } from '@/types'
import { useStore } from '@/store'

const scheduleTypeOptions = [
  { value: 'working', label: '上班', color: 'green' },
  { value: 'leave', label: '请假', color: 'red' },
  { value: 'meeting', label: '会议', color: 'orange' },
  { value: 'training', label: '培训', color: 'blue' },
]

function ScheduleManagement() {
  const schedules = useStore(state => state.consultantSchedules)
  const consultants = useStore(state => state.consultants)
  const addSchedule = useStore(state => state.addSchedule)
  const updateSchedule = useStore(state => state.updateSchedule)
  const deleteSchedule = useStore(state => state.deleteSchedule)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ConsultantSchedule | null>(null)
  const [form] = Form.useForm()

  const activeConsultants = consultants.filter(c => c.isActive)

  const handleAdd = () => {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({
      type: 'working',
      startTime: '09:00',
      endTime: '18:00',
    })
    setModalOpen(true)
  }

  const handleEdit = (item: ConsultantSchedule) => {
    setEditingItem(item)
    form.setFieldsValue({
      ...item,
      date: dayjs(item.date),
      startTime: item.startTime,
      endTime: item.endTime,
    })
    setModalOpen(true)
  }

  const handleDelete = (id: string) => {
    deleteSchedule(id)
    message.success('删除成功')
  }

  const handleSubmit = () => {
    form.validateFields().then(values => {
      const data = {
        consultantId: values.consultantId,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime,
        endTime: values.endTime,
        type: values.type,
        description: values.description,
      }
      if (editingItem) {
        updateSchedule(editingItem.id, data)
        message.success('更新成功')
      } else {
        addSchedule(data)
        message.success('添加成功')
      }
      setModalOpen(false)
    })
  }

  const today = dayjs().format('YYYY-MM-DD')
  const todaySchedules = schedules.filter(s => s.date === today)

  const columns = [
    {
      title: '顾问',
      dataIndex: 'consultantId',
      key: 'consultantId',
      width: 120,
      render: (id: string) => {
        const c = consultants.find(item => item.id === id)
        return c?.name ?? '未知'
      },
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const opt = scheduleTypeOptions.find(o => o.value === type)
        return <Tag color={opt?.color}>{opt?.label}</Tag>
      },
    },
    {
      title: '时间',
      key: 'time',
      width: 180,
      render: (_: unknown, record: ConsultantSchedule) => (
        <span>{record.startTime} - {record.endTime}</span>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      width: 200,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: ConsultantSchedule) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="排班总数"
              value={schedules.length}
              prefix={<ScheduleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日上班"
              value={todaySchedules.filter(s => s.type === 'working').length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日请假/会议"
              value={todaySchedules.filter(s => s.type !== 'working').length}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {todaySchedules.length > 0 && (
        <Card title={`今日排班（${today}）`} size="small">
          <Space wrap>
            {todaySchedules.map(s => {
              const c = consultants.find(item => item.id === s.consultantId)
              const opt = scheduleTypeOptions.find(o => o.value === s.type)
              return (
                <Tag key={s.id} color={opt?.color} style={{ padding: '4px 12px', fontSize: 14 }}>
                  {c?.name}：{opt?.label} ({s.startTime}-{s.endTime})
                </Tag>
              )
            })}
          </Space>
        </Card>
      )}

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={activeConsultants.length === 0}>
            新增排班
          </Button>
          {activeConsultants.length === 0 && (
            <span style={{ color: '#999' }}>请先在「销售顾问」页面添加在职顾问</span>
          )}
        </Space>

        <Table
          columns={columns}
          dataSource={schedules.slice().sort((a, b) => b.date.localeCompare(a.date))}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑排班' : '新增排班'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="consultantId" label="顾问" rules={[{ required: true, message: '请选择顾问' }]}>
            <Select
              options={activeConsultants.map(c => ({ value: c.id, label: c.name }))}
              placeholder="请选择顾问"
            />
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
          </Form.Item>
          <Form.Item name="type" label="排班类型" rules={[{ required: true }]}>
            <Select
              options={scheduleTypeOptions.map(o => ({ value: o.value, label: o.label }))}
            />
          </Form.Item>
          <Form.Item label="时间">
            <Space>
              <Form.Item name="startTime" noStyle rules={[{ required: true }]}>
                <TimePicker format="HH:mm" placeholder="开始" />
              </Form.Item>
              <span>至</span>
              <Form.Item name="endTime" noStyle rules={[{ required: true }]}>
                <TimePicker format="HH:mm" placeholder="结束" />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Select
              mode="tags"
              placeholder="可选：填写说明（可直接输入）"
              options={[
                { value: '全天', label: '全天' },
                { value: '上午', label: '上午' },
                { value: '下午', label: '下午' },
                { value: '团队会议', label: '团队会议' },
                { value: '厂家培训', label: '厂家培训' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default ScheduleManagement
