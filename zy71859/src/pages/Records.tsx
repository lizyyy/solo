import { useState, useMemo } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Card,
  Modal,
  Form,
  message,
  Popconfirm,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Download,
  Search,
  Edit,
  Trash2,
  Eye,
  RotateCcw,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { exportRecordsToExcel } from '@/utils/export'
import type { ColumnsType } from 'antd/es/table'
import type { PracticeRecord } from '@/types'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

export default function Records() {
  const navigate = useNavigate()
  const { records, parts, tableState, updateTableState, updateRecord, deleteRecord, addRecord } =
    useAppStore()
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PracticeRecord | null>(null)
  const [form] = Form.useForm()

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (searchText) {
        const search = searchText.toLowerCase()
        if (
          !record.studentName.toLowerCase().includes(search) &&
          !record.studentId.toLowerCase().includes(search)
        ) {
          return false
        }
      }
      if (statusFilter && record.status !== statusFilter) {
        return false
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        const practiceDate = dayjs(record.practiceDate)
        if (
          practiceDate.isBefore(dateRange[0].startOf('day')) ||
          practiceDate.isAfter(dateRange[1].endOf('day'))
        ) {
          return false
        }
      }
      return true
    })
  }, [records, searchText, statusFilter, dateRange])

  const getPartName = (partId: string) => {
    return parts.find((p) => p.id === partId)?.name || partId
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; class: string }> = {
      pending: { text: '待处理', class: 'status-pending' },
      processing: { text: '进行中', class: 'status-processing' },
      completed: { text: '已完成', class: 'status-completed' },
      failed: { text: '失败', class: 'status-failed' },
    }
    const s = statusMap[status] || { text: status, class: '' }
    return <span className={`status-badge ${s.class}`}>{s.text}</span>
  }

  const handleExport = () => {
    exportRecordsToExcel(filteredRecords, parts)
    message.success('导出成功')
  }

  const handleEdit = (record: PracticeRecord) => {
    setEditingRecord(record)
    form.setFieldsValue({
      ...record,
      practiceDate: dayjs(record.practiceDate),
    })
    setEditModalVisible(true)
  }

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (editingRecord) {
        updateRecord(editingRecord.id, {
          ...values,
          practiceDate: values.practiceDate.toISOString(),
        })
        message.success('更新成功')
      } else {
        addRecord({
          ...values,
          practiceDate: values.practiceDate.toISOString(),
          operator: '张老师',
          partId: values.partId || parts[0]?.id,
          scriptId: 'script_001',
          status: values.status || 'pending',
          score: values.score || 0,
          studentName: values.studentName,
          studentId: values.studentId,
        })
        message.success('添加成功')
      }
      setEditModalVisible(false)
      setEditingRecord(null)
      form.resetFields()
    })
  }

  const handleDelete = (id: string) => {
    deleteRecord(id)
    message.success('删除成功')
  }

  const handleReset = () => {
    setSearchText('')
    setStatusFilter(undefined)
    setDateRange(null)
    updateTableState({
      current: 1,
      filters: {},
    })
  }

  const columns: ColumnsType<PracticeRecord> = [
    {
      title: '学生姓名',
      dataIndex: 'studentName',
      key: 'studentName',
      width: 100,
      render: (text) => <span className="font-medium">{text}</span>,
    },
    {
      title: '学号',
      dataIndex: 'studentId',
      key: 'studentId',
      width: 130,
    },
    {
      title: '练习日期',
      dataIndex: 'practiceDate',
      key: 'practiceDate',
      width: 120,
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
      sorter: (a, b) => dayjs(a.practiceDate).unix() - dayjs(b.practiceDate).unix(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusBadge(status),
      filters: [
        { text: '待处理', value: 'pending' },
        { text: '进行中', value: 'processing' },
        { text: '已完成', value: 'completed' },
        { text: '失败', value: 'failed' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '分数',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      sorter: (a, b) => a.score - b.score,
    },
    {
      title: '使用零件',
      dataIndex: 'partId',
      key: 'partId',
      width: 150,
      render: (partId) => (
        <span
          className="trace-link"
          onClick={() => navigate(`/parts?highlight=${partId}`)}
        >
          {getPartName(partId)}
        </span>
      ),
    },
    {
      title: '操作员',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<Eye size={14} />}
            onClick={() => navigate(`/records/${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<Edit size={14} />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<Trash2 size={14} />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card bordered={false} className="stat-card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Input
            placeholder="搜索学生姓名/学号"
            prefix={<Search size={16} className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            allowClear
            options={[
              { value: 'pending', label: '待处理' },
              { value: 'processing', label: '进行中' },
              { value: 'completed', label: '已完成' },
              { value: 'failed', label: '失败' },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            style={{ width: 260 }}
          />
          <Button icon={<RotateCcw size={14} />} onClick={handleReset}>
            重置
          </Button>
          <div className="flex-1" />
          <Button type="primary" icon={<Plus size={14} />} onClick={() => {
            setEditingRecord(null)
            form.resetFields()
            setEditModalVisible(true)
          }}>
            新增记录
          </Button>
          <Button icon={<Download size={14} />} onClick={handleExport}>
            导出当前筛选
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="id"
          pagination={{
            current: tableState.current,
            pageSize: tableState.pageSize,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => updateTableState({ current: page, pageSize }),
          }}
          scroll={{ x: 1000 }}
          size="middle"
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑记录' : '新增记录'}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => {
          setEditModalVisible(false)
          setEditingRecord(null)
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="studentName" label="学生姓名" rules={[{ required: true }]}>
            <Input placeholder="请输入学生姓名" />
          </Form.Item>
          <Form.Item name="studentId" label="学号" rules={[{ required: true }]}>
            <Input placeholder="请输入学号" />
          </Form.Item>
          <Form.Item name="practiceDate" label="练习日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'pending', label: '待处理' },
                { value: 'processing', label: '进行中' },
                { value: 'completed', label: '已完成' },
                { value: 'failed', label: '失败' },
              ]}
            />
          </Form.Item>
          <Form.Item name="score" label="分数" rules={[{ required: true }]}>
            <Input type="number" placeholder="请输入分数" />
          </Form.Item>
          <Form.Item name="partId" label="使用零件">
            <Select
              options={parts.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
