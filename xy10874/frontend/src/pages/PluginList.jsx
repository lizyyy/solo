import React, { useState, useEffect } from 'react'
import { Button, Table, Select, Modal, Form, Input, message, Space, Row, Col } from 'antd'
import { PlusOutlined, ExportOutlined, SyncOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { pluginAPI } from '../api'
import dayjs from 'dayjs'

const { Option } = Select

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

function PluginList() {
  const navigate = useNavigate()
  const [plugins, setPlugins] = useState([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState(null)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [form] = Form.useForm()

  useEffect(() => {
    loadPlugins()
  }, [pagination.current, pagination.pageSize, statusFilter])

  const loadPlugins = async () => {
    setLoading(true)
    try {
      const res = await pluginAPI.list({
        status: statusFilter,
        page: pagination.current,
        limit: pagination.pageSize
      })
      setPlugins(res.data.data)
      setPagination(prev => ({
        ...prev,
        total: res.data.pagination.total
      }))
    } catch (err) {
      message.error('加载插件列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlugin = async (values) => {
    try {
      await pluginAPI.create(values)
      message.success('创建成功')
      setIsModalOpen(false)
      form.resetFields()
      loadPlugins()
    } catch (err) {
      message.error(err.response?.data?.error || '创建失败')
    }
  }

  const handleExport = async () => {
    try {
      const res = await pluginAPI.exportCSV()
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `plugins_${dayjs().format('YYYYMMDD')}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch (err) {
      message.error('导出失败')
    }
  }

  const columns = [
    {
      title: '插件名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text, record) => (
        <a onClick={() => navigate(`/plugins/${record.id}`)} style={{ fontWeight: 500 }}>
          {text}
        </a>
      )
    },
    { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
    { title: '作者', dataIndex: 'author', key: 'author', width: 120 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '平台兼容',
      key: 'compatibility',
      width: 150,
      render: (_, record) => `${record.min_platform_version}${record.max_platform_version ? ' ~ ' + record.max_platform_version : ''}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
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
      width: 160,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button type="link" onClick={() => navigate(`/plugins/${record.id}`)}>
          详情
        </Button>
      )
    }
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <h2>插件列表</h2>
        </Col>
        <Col>
          <Space>
            <Select
              placeholder="筛选状态"
              style={{ width: 150 }}
              allowClear
              onChange={setStatusFilter}
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
            <Button icon={<SyncOutlined />} onClick={loadPlugins}>刷新</Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>导出CSV</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
              新建插件
            </Button>
          </Space>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={plugins}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize }))
        }}
      />

      <Modal
        title="新建插件"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreatePlugin}
        >
          <Form.Item
            name="name"
            label="插件名称"
            rules={[{ required: true, message: '请输入插件名称' }]}
          >
            <Input placeholder="请输入插件名称" />
          </Form.Item>
          <Form.Item
            name="version"
            label="插件版本"
            rules={[{ required: true, message: '请输入插件版本' }]}
          >
            <Input placeholder="例如: 1.0.0" />
          </Form.Item>
          <Form.Item
            name="author"
            label="作者"
            rules={[{ required: true, message: '请输入作者' }]}
          >
            <Input placeholder="请输入作者" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入插件描述" />
          </Form.Item>
          <Form.Item
            name="min_platform_version"
            label="最低平台版本"
            rules={[{ required: true, message: '请输入最低平台版本' }]}
          >
            <Input placeholder="例如: 3.0.0" />
          </Form.Item>
          <Form.Item name="max_platform_version" label="最高平台版本">
            <Input placeholder="可选，例如: 3.2.0" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PluginList
