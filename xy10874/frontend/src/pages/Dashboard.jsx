import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Table, Tag, Button, Statistic, message } from 'antd'
import { ArrowUpOutlined, FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { dashboardAPI, pluginAPI } from '../api'
import dayjs from 'dayjs'

const STATUS_LABELS = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  AUTO_AUDITING: '自动审核中',
  PENDING_REVIEW: '待人工审核',
  AUTO_PASSED: '自动通过',
  APPROVED: '审核通过',
  RELEASED: '已上架',
  ROLLED_BACK: '已回滚',
  REJECTED: '已拒绝'
}

function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const res = await dashboardAPI.getStats()
      setStats(res.data)
    } catch (err) {
      message.error('加载统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: '插件名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/plugins/${record.id}`)}>{text}</a>
      )
    },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '作者', dataIndex: 'author', key: 'author' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <span className={`status-badge status-${status}`}>
          {STATUS_LABELS[status] || status}
        </span>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    }
  ]

  if (loading) return <div>加载中...</div>

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>审核总览</h2>
      
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日审核"
              value={stats?.today_audits || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核"
              value={stats?.by_status?.PENDING_REVIEW || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已通过"
              value={stats?.by_status?.APPROVED || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已上架"
              value={stats?.by_status?.RELEASED || 0}
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="各状态统计">
            <Row gutter={8}>
              {Object.entries(stats?.by_status || {}).map(([status, count]) => (
                <Col key={status} span={2} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{count}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {STATUS_LABELS[status] || status}
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <Card
        title="最近插件"
        extra={
          <Button type="link" onClick={() => navigate('/plugins')}>
            查看全部
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={stats?.recent_plugins || []}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  )
}

export default Dashboard
