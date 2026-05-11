import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, message, Space, Tag, Row, Col, Card } from 'antd'
import { PlusOutlined, CheckCircleOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons'
import { groupApi, compensationApi } from '../utils/api'

const GroupsPage = () => {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, totalOutOfStock: 0 })

  const loadGroups = async () => {
    setLoading(true)
    try {
      const res = await groupApi.getAll()
      setGroups(res.data)
      const total = res.data.length
      const completed = res.data.filter(g => g.status === 'completed').length
      const pending = res.data.filter(g => g.status === 'pending').length
      const totalOutOfStock = res.data.reduce((sum, g) => sum + (g.out_of_stock_count || 0), 0)
      setStats({ total, completed, pending, totalOutOfStock })
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  const handleCreate = async (values) => {
    try {
      await groupApi.create(values)
      message.success('创建成功')
      setModalVisible(false)
      form.resetFields()
      loadGroups()
    } catch (err) {
      message.error(err.response?.data?.error || '创建失败')
    }
  }

  const handleComplete = async (id) => {
    try {
      await groupApi.complete(id)
      message.success('拼团已完成')
      loadGroups()
    } catch (err) {
      message.error('操作失败')
    }
  }

  const handleExportLeader = (groupId) => {
    window.open(compensationApi.exportLeaderSummary(groupId), '_blank')
  }

  const handleExportExcel = (groupId) => {
    window.open(compensationApi.exportExcel(groupId), '_blank')
  }

  const columns = [
    {
      title: '拼团号',
      dataIndex: 'group_code',
      key: 'group_code',
      width: 120
    },
    {
      title: '拼团名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '订单数',
      dataIndex: 'order_count',
      key: 'order_count',
      width: 80
    },
    {
      title: '缺货数',
      dataIndex: 'out_of_stock_count',
      key: 'out_of_stock_count',
      width: 80,
      render: (text) => text > 0 ? <Tag color="red">{text}</Tag> : <span>0</span>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => status === 'completed' ? <Tag color="green">已完成</Tag> : <Tag color="orange">进行中</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180
    },
    {
      title: '操作',
      key: 'action',
      width: 350,
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => handleComplete(record.id)}>
              标记成团
            </Button>
          )}
          <Button size="small" icon={<FileTextOutlined />} onClick={() => handleExportLeader(record.id)}>
            团长汇总
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => handleExportExcel(record.id)}>
            导出Excel
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card className="stat-card">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">总拼团数</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <div className="stat-number" style={{ color: '#52c41a' }}>{stats.completed}</div>
            <div className="stat-label">已完成</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <div className="stat-number" style={{ color: '#faad14' }}>{stats.pending}</div>
            <div className="stat-label">进行中</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <div className="stat-number" style={{ color: '#ff4d4f' }}>{stats.totalOutOfStock}</div>
            <div className="stat-label">待处理缺货</div>
          </Card>
        </Col>
      </Row>

      <div className="page-header">
        <h2 className="page-title">成团列表</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新建拼团
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={groups}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title="新建拼团"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="group_code" label="拼团号" rules={[{ required: true, message: '请输入拼团号' }]}>
            <Input placeholder="例如：G20240101" />
          </Form.Item>
          <Form.Item name="name" label="拼团名称" rules={[{ required: true, message: '请输入拼团名称' }]}>
            <Input placeholder="例如：水果拼团2024-01" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default GroupsPage
