import React, { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Space,
  Card,
  Statistic,
  Row,
  Col,
  Tag,
  message,
  Select,
  Input,
  Modal,
  Typography,
} from 'antd'
import {
  SyncOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { ipc } from '../ipc'
import type { SyncStatus, SyncStats } from '../../types'

const { Text } = Typography

const statusMap: Record<SyncStatus, { label: string; color: string }> = {
  PENDING: { label: '待同步', color: 'warning' },
  SYNCING: { label: '同步中', color: 'processing' },
  SUCCESS: { label: '已成功', color: 'success' },
  FAILED: { label: '已失败', color: 'error' },
}

function SyncPage() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<SyncStats | null>(null)
  const [statusFilter, setStatusFilter] = useState<SyncStatus | undefined>()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentItem, setCurrentItem] = useState<any>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.type = typeFilter

      const [itemsResult, statsResult] = await Promise.all([
        ipc.sync.listQueue(params),
        ipc.sync.getStats(),
      ])

      if (itemsResult.success) {
        setItems(itemsResult.data.items)
        setTotal(itemsResult.data.total)
      }
      if (statsResult.success) {
        setStats(statsResult.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleProcessQueue = async () => {
    message.info('正在处理同步队列...')
    const result = await ipc.sync.processQueue()
    if (result.success) {
      message.success('同步处理完成')
      loadData()
    } else {
      message.error(result.error)
    }
  }

  const handleRetryFailed = async () => {
    if (!stats || stats.failed === 0) {
      message.info('没有失败的同步项')
      return
    }
    const result = await ipc.sync.retryFailed()
    if (result.success) {
      message.success('已重试失败的同步项')
      loadData()
    } else {
      message.error(result.error)
    }
  }

  const handleResetItem = async (itemId: string) => {
    const result = await ipc.sync.resetItem(itemId)
    if (result.success) {
      message.success('已重置同步状态')
      loadData()
    } else {
      message.error(result.error)
    }
  }

  const handleAddTestItem = async () => {
    const result = await ipc.sync.addToQueue({
      type: 'TEST_' + Date.now(),
      payload: { type: 'test', data: { test: true, timestamp: Date.now() } },
      userId: 'current',
      maxRetries: 3,
    })
    if (result.success) {
      message.success('已添加测试同步项')
      loadData()
    } else {
      message.error(result.error)
    }
  }

  const columns = [
    { title: '类型', dataIndex: 'type', key: 'type', width: 150,
      render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '数据', dataIndex: 'payload', key: 'payload', width: 250,
      render: (v: string) => {
        try {
          const data = JSON.parse(v)
          return <Text ellipsis style={{ maxWidth: 240 }}>{JSON.stringify(data)}</Text>
        } catch {
          return v
        }
      }},
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (v: SyncStatus) => <Tag color={statusMap[v].color}>{statusMap[v].label}</Tag> },
    { title: '重试次数', key: 'retry', width: 100,
      render: (_: any, r: any) => `${r.retryCount} / ${r.maxRetries}` },
    { title: '上次尝试', dataIndex: 'lastAttempt', key: 'lastAttempt', width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '错误信息', dataIndex: 'lastError', key: 'lastError', width: 200,
      render: (v: string) => v ? <Text type="danger" ellipsis style={{ maxWidth: 190 }}>{v}</Text> : '-' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180,
      render: (v: string) => new Date(v).toLocaleString() },
    { title: '操作', key: 'action', width: 180,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" onClick={() => {
            setCurrentItem(r)
            setDetailVisible(true)
          }}>详情</Button>
          {r.status === 'FAILED' && (
            <Button size="small" type="primary" onClick={() => handleResetItem(r.id)}>重置</Button>
          )}
        </Space>
      )
    },
  ]

  return (
    <div>
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="待同步"
                value={stats.pending}
                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="同步中"
                value={stats.syncing}
                prefix={<LoadingOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已成功"
                value={stats.success}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已失败"
                value={stats.failed}
                prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            style={{ width: 120 }}
          >
            {(Object.keys(statusMap) as SyncStatus[]).map(s => (
              <Select.Option key={s} value={s}>{statusMap[s].label}</Select.Option>
            ))}
          </Select>
          <Input
            placeholder="类型筛选"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value || undefined)}
            onPressEnter={loadData}
            style={{ width: 150 }}
          />
          <Button type="primary" onClick={loadData}>搜索</Button>
          <Button type="primary" icon={<SyncOutlined />} onClick={handleProcessQueue}>处理同步</Button>
          <Button icon={<ReloadOutlined />} onClick={handleRetryFailed}>重试失败</Button>
          <Button onClick={handleAddTestItem}>添加测试数据</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={{ total, pageSize: 20 }}
      />

      <Modal
        title="同步项详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {currentItem && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>类型: </Text>
              <Tag color="blue">{currentItem.type}</Tag>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>状态: </Text>
              <Tag color={statusMap[currentItem.status].color}>
                {statusMap[currentItem.status].label}
              </Tag>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>重试: </Text>
              {currentItem.retryCount} / {currentItem.maxRetries}
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>数据载荷:</Text>
              <pre style={{
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 4,
                marginTop: 8,
                maxHeight: 200,
                overflow: 'auto',
              }}>
                {currentItem.payload}
              </pre>
            </div>
            {currentItem.lastError && (
              <div>
                <Text strong type="danger">错误信息:</Text>
                <pre style={{
                  background: '#fff1f0',
                  color: '#cf1322',
                  padding: 12,
                  borderRadius: 4,
                  marginTop: 8,
                  maxHeight: 150,
                  overflow: 'auto',
                }}>
                  {currentItem.lastError}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default SyncPage
