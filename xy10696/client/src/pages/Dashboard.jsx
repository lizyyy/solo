import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Button, Space } from 'antd'
import { WarningOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'

function Dashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0, by_type: [] })
  const [exceptions, setExceptions] = useState([])

  useEffect(() => {
    fetchStats()
    fetchExceptions()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/exceptions/stats')
      setStats(res.data)
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }

  const fetchExceptions = async () => {
    try {
      const res = await axios.get('/api/exceptions', { params: { status: 'pending' } })
      setExceptions(res.data.slice(0, 10))
    } catch (error) {
      console.error('获取异常数据失败:', error)
    }
  }

  const handleResolve = async (id) => {
    try {
      await axios.put(`/api/exceptions/${id}`, { status: 'resolved', operator: '管理员' })
      fetchExceptions()
      fetchStats()
    } catch (error) {
      console.error('处理异常失败:', error)
    }
  }

  const exceptionColumns = [
    {
      title: '设备编号',
      dataIndex: 'device_number',
      key: 'device_number',
    },
    {
      title: '异常类型',
      dataIndex: 'exception_type',
      key: 'exception_type',
      render: (type) => {
        const colorMap = {
          low_battery: 'orange',
          low_battery_rent: 'orange',
          low_battery_return: 'orange',
          damage_found: 'red',
        }
        return <Tag color={colorMap[type] || 'blue'}>{type}</Tag>
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '责任人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" onClick={() => handleResolve(record.id)}>
          标记已解决
        </Button>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>异常看板</h2>
      
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="异常总数"
              value={stats.total}
              prefix={<WarningOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="待处理"
              value={stats.pending}
              prefix={<ClockCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已解决"
              value={stats.resolved}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="异常类型分布" style={{ marginBottom: 24 }}>
        <Space size="large">
          {stats.by_type.map((item) => (
            <Tag key={item.exception_type} color="blue" style={{ fontSize: 14, padding: '8px 16px' }}>
              {item.exception_type}: {item.count}
            </Tag>
          ))}
        </Space>
      </Card>

      <Card title="待处理异常列表">
        <Table
          columns={exceptionColumns}
          dataSource={exceptions}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  )
}

export default Dashboard
