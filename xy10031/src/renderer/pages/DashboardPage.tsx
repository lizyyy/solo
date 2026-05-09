import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, List, Tag, message, Spin } from 'antd'
import {
  BoxOutlined,
  ClipboardListOutlined,
  SyncOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { ipc } from '../ipc'
import { authStore } from '../store/authStore'
import type { SyncStats, TaskStatus } from '../../types'

interface TaskCount {
  PENDING: number
  IN_PROGRESS: number
  PENDING_APPROVAL: number
  APPROVED: number
  REJECTED: number
  CANCELLED: number
}

function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [productCount, setProductCount] = useState(0)
  const [myTaskCount, setMyTaskCount] = useState<TaskCount>({
    PENDING: 0, IN_PROGRESS: 0, PENDING_APPROVAL: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0
  })
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null)
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any[]>([])

  const loadData = async () => {
    setLoading(true)
    try {
      const userId = authStore.currentUser?.id
      const [productsResult, tasksResult, syncResult, logsResult, lowStockResult] = await Promise.all([
        ipc.inventory.listProducts({ take: 1 }),
        userId ? ipc.task.listTasks({ assigneeId: userId }) : Promise.resolve({ success: true, data: { tasks: [], total: 0 } }),
        ipc.sync.getStats(),
        ipc.log.getLogs({ take: 10 }),
        ipc.inventory.getLowStock(10),
      ])

      if (productsResult.success) {
        setProductCount(productsResult.data.total)
      }

      if (tasksResult.success) {
        const counts: TaskCount = { PENDING: 0, IN_PROGRESS: 0, PENDING_APPROVAL: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 }
        for (const t of tasksResult.data.tasks) {
          counts[t.status]++
        }
        setMyTaskCount(counts)
      }

      if (syncResult.success) {
        setSyncStats(syncResult.data)
      }

      if (logsResult.success) {
        setRecentLogs(logsResult.data.logs)
      }

      if (lowStockResult.success) {
        setLowStock(lowStockResult.data.slice(0, 5))
      }
    } catch (err) {
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
  }

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="商品总数"
              value={productCount}
              prefix={<BoxOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="进行中任务"
              value={myTaskCount.IN_PROGRESS}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="待审批任务"
              value={myTaskCount.PENDING_APPROVAL}
              prefix={<ClipboardListOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="同步失败"
              value={syncStats?.failed || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="同步状态" size="small">
            {syncStats && (
              <Row gutter={16}>
                <Col span={6} style={{ textAlign: 'center' }}>
                  <ClockCircleOutlined style={{ fontSize: 24, color: '#faad14' }} />
                  <div><strong>{syncStats.pending}</strong></div>
                  <div style={{ fontSize: 12, color: '#999' }}>待同步</div>
                </Col>
                <Col span={6} style={{ textAlign: 'center' }}>
                  <LoadingOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                  <div><strong>{syncStats.syncing}</strong></div>
                  <div style={{ fontSize: 12, color: '#999' }}>同步中</div>
                </Col>
                <Col span={6} style={{ textAlign: 'center' }}>
                  <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                  <div><strong>{syncStats.success}</strong></div>
                  <div style={{ fontSize: 12, color: '#999' }}>已成功</div>
                </Col>
                <Col span={6} style={{ textAlign: 'center' }}>
                  <CloseCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                  <div><strong>{syncStats.failed}</strong></div>
                  <div style={{ fontSize: 12, color: '#999' }}>已失败</div>
                </Col>
              </Row>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="库存预警（低于10件）" size="small">
            {lowStock.length > 0 ? (
              <List
                size="small"
                dataSource={lowStock}
                renderItem={(item) => (
                  <List.Item>
                    <span style={{ flex: 1 }}>{item.product.sku} - {item.product.name}</span>
                    <Tag color="red">
                      <WarningOutlined /> {item.quantity} {item.product.unit}
                    </Tag>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 16 }}>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />
                <div>库存状况良好</div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card title="最近操作日志" size="small" style={{ marginTop: 16 }}>
        <List
          size="small"
          dataSource={recentLogs}
          renderItem={(log) => (
            <List.Item>
              <span style={{ width: 160, color: '#999', fontSize: 12 }}>
                {new Date(log.createdAt).toLocaleString()}
              </span>
              <Tag color={log.level === 'ERROR' ? 'red' : log.level === 'WARN' ? 'orange' : 'blue'}>
                {log.module}:{log.action}
              </Tag>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.details}
              </span>
              <Tag>{log.user?.name}</Tag>
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}

export default DashboardPage
