import React, { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Space,
  Card,
  Tag,
  message,
  Select,
  DatePicker,
  Typography,
} from 'antd'
import { ExportOutlined, ReloadOutlined } from '@ant-design/icons'
import { ipc } from '../ipc'
import type { LogLevel } from '../../types'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Text } = Typography

const moduleOptions = [
  { label: '全部', value: undefined },
  { label: '用户', value: 'USER' },
  { label: '商品', value: 'PRODUCT' },
  { label: '库存', value: 'INVENTORY' },
  { label: '任务', value: 'TASK' },
  { label: '同步', value: 'SYNC' },
]

const levelMap: Record<LogLevel, { label: string; color: string }> = {
  INFO: { label: 'INFO', color: 'blue' },
  WARN: { label: 'WARN', color: 'orange' },
  ERROR: { label: 'ERROR', color: 'red' },
  DEBUG: { label: 'DEBUG', color: 'default' },
}

function LogsPage() {
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [users, setUsers] = useState<any[]>([])
  const [levelFilter, setLevelFilter] = useState<LogLevel | undefined>()
  const [moduleFilter, setModuleFilter] = useState<string | undefined>()
  const [userFilter, setUserFilter] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (levelFilter) params.level = levelFilter
      if (moduleFilter) params.module = moduleFilter
      if (userFilter) params.userId = userFilter
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].toDate()
        params.endDate = dateRange[1].toDate()
      }

      const [logsResult, usersResult] = await Promise.all([
        ipc.log.getLogs(params),
        ipc.auth.listUsers(),
      ])

      if (logsResult.success) {
        setLogs(logsResult.data.logs)
        setTotal(logsResult.data.total)
      }
      if (usersResult.success) {
        setUsers(usersResult.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleExport = async () => {
    const dialog = await ipc.export.saveDialog()
    if (!dialog.success || !dialog.filePath) return

    const filePath = dialog.filePath.endsWith('.xlsx') ? dialog.filePath : dialog.filePath + '.xlsx'
    const params: any = {}
    if (levelFilter) params.level = levelFilter
    if (moduleFilter) params.module = moduleFilter
    if (userFilter) params.userId = userFilter
    if (dateRange && dateRange[0] && dateRange[1]) {
      params.startDate = dateRange[0].toDate()
      params.endDate = dateRange[1].toDate()
    }

    const result = await ipc.export.logsExcel(filePath, params)
    if (result.success) {
      message.success(`已导出 ${result.data.count} 条日志`)
    } else {
      message.error(result.error)
    }
  }

  const columns = [
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180,
      render: (v: string) => new Date(v).toLocaleString() },
    { title: '用户', key: 'user', width: 100,
      render: (_: any, r: any) => r.user?.name || '-' },
    { title: '级别', dataIndex: 'level', key: 'level', width: 80,
      render: (v: LogLevel) => <Tag color={levelMap[v].color}>{levelMap[v].label}</Tag> },
    { title: '模块', dataIndex: 'module', key: 'module', width: 100,
      render: (v: string) => <Tag>{v}</Tag> },
    { title: '操作', dataIndex: 'action', key: 'action', width: 100 },
    { title: '详情', dataIndex: 'details', key: 'details', flex: 1,
      render: (v: string) => {
        try {
          const data = JSON.parse(v)
          return (
            <Text ellipsis style={{ display: 'block', maxWidth: '100%' }}>
              {JSON.stringify(data)}
            </Text>
          )
        } catch {
          return v
        }
      }
    },
  ]

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="级别"
            value={levelFilter}
            onChange={setLevelFilter}
            allowClear
            style={{ width: 100 }}
          >
            <Select.Option value="INFO"><Tag color="blue">INFO</Tag></Select.Option>
            <Select.Option value="WARN"><Tag color="orange">WARN</Tag></Select.Option>
            <Select.Option value="ERROR"><Tag color="red">ERROR</Tag></Select.Option>
            <Select.Option value="DEBUG"><Tag>DEBUG</Tag></Select.Option>
          </Select>
          <Select
            placeholder="模块"
            value={moduleFilter}
            onChange={setModuleFilter}
            allowClear
            style={{ width: 120 }}
          >
            {moduleOptions.slice(1).map(o => (
              <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
            ))}
          </Select>
          <Select
            placeholder="用户"
            value={userFilter}
            onChange={setUserFilter}
            allowClear
            style={{ width: 120 }}
          >
            {users.map(u => (
              <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={setDateRange as any}
            showTime
          />
          <Button type="primary" onClick={loadData}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={() => {
            setLevelFilter(undefined)
            setModuleFilter(undefined)
            setUserFilter(undefined)
            setDateRange(null)
            loadData()
          }}>重置</Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出Excel</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={logs}
        loading={loading}
        pagination={{ total, pageSize: 20 }}
      />
    </div>
  )
}

export default LogsPage
