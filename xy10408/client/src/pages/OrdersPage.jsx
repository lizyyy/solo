import React, { useState, useEffect } from 'react'
import { Table, Button, Upload, message, Space, Tag, Select, Modal, Form, Input } from 'antd'
import { UploadOutlined, WarningOutlined } from '@ant-design/icons'
import { orderApi, groupApi } from '../utils/api'

const OrdersPage = () => {
  const [orders, setOrders] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [reasonModalVisible, setReasonModalVisible] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [form] = Form.useForm()

  const loadOrders = async () => {
    setLoading(true)
    try {
      const params = {}
      if (selectedGroup) params.group_id = selectedGroup
      if (selectedStatus) params.status = selectedStatus
      const res = await orderApi.getAll(params)
      setOrders(res.data)
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadGroups = async () => {
    try {
      const res = await groupApi.getAll()
      setGroups(res.data)
    } catch (err) {
      message.error('加载拼团失败')
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  useEffect(() => {
    loadOrders()
  }, [selectedGroup, selectedStatus])

  const handleImport = async (file) => {
    try {
      const res = await orderApi.import(file)
      message.success(`成功导入 ${res.data.processed} 条，失败 ${res.data.failed} 条`)
      loadOrders()
    } catch (err) {
      message.error(err.response?.data?.error || '导入失败')
    }
    return false
  }

  const handleMarkOutOfStock = (order) => {
    setSelectedOrder(order)
    form.resetFields()
    setReasonModalVisible(true)
  }

  const handleConfirmReason = async (values) => {
    try {
      await orderApi.markOutOfStock(selectedOrder.id, values.reason)
      message.success('已标记为缺货')
      setReasonModalVisible(false)
      loadOrders()
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  const getStatusTag = (status) => {
    const map = {
      pending: { color: 'default', text: '待处理' },
      out_of_stock: { color: 'red', text: '缺货' },
      handled: { color: 'green', text: '已处理' },
      refunded: { color: 'orange', text: '已退款' }
    }
    const info = map[status] || { color: 'default', text: status }
    return <Tag color={info.color}>{info.text}</Tag>
  }

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 150
    },
    {
      title: '拼团',
      dataIndex: 'group_name',
      key: 'group_name',
      width: 150,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <span>{text}</span>
          <span style={{ fontSize: 12, color: '#999' }}>{record.group_code}</span>
        </Space>
      )
    },
    {
      title: '用户',
      key: 'user',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.user_name}</span>
          <span style={{ fontSize: 12, color: '#999' }}>{record.user_phone}</span>
        </Space>
      )
    },
    {
      title: '商品',
      key: 'product',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.product_name}</span>
          <span style={{ fontSize: 12, color: '#999' }}>{record.product_specs} × {record.quantity}</span>
        </Space>
      )
    },
    {
      title: '金额',
      key: 'amount',
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>¥{record.total_amount?.toFixed(2)}</span>
          <span style={{ fontSize: 12, color: '#999' }}>实付: ¥{record.paid_amount?.toFixed(2)}</span>
        </Space>
      )
    },
    {
      title: '拼团状态',
      dataIndex: 'group_status',
      key: 'group_status',
      width: 100,
      render: (status) => status === 'completed' ? <Tag color="green">已完成</Tag> : <Tag color="orange">进行中</Tag>
    },
    {
      title: '订单状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: getStatusTag
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        record.status === 'pending' && record.group_status === 'completed' ? (
          <Button type="link" icon={<WarningOutlined />} danger onClick={() => handleMarkOutOfStock(record)}>
            标记缺货
          </Button>
        ) : null
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">订单管理</h2>
        <Upload
          beforeUpload={handleImport}
          showUploadList={false}
          accept=".xlsx,.xls"
        >
          <Button type="primary" icon={<UploadOutlined />}>
            导入订单
          </Button>
        </Upload>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <span>拼团筛选：</span>
          <Select
            placeholder="全部拼团"
            style={{ width: 200 }}
            allowClear
            value={selectedGroup}
            onChange={setSelectedGroup}
            options={groups.map(g => ({ label: g.name, value: g.id }))}
          />
          <span>状态筛选：</span>
          <Select
            placeholder="全部状态"
            style={{ width: 150 }}
            allowClear
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={[
              { label: '待处理', value: 'pending' },
              { label: '缺货', value: 'out_of_stock' },
              { label: '已处理', value: 'handled' },
              { label: '已退款', value: 'refunded' }
            ]}
          />
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="标记缺货"
        open={reasonModalVisible}
        onCancel={() => setReasonModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleConfirmReason} layout="vertical">
          <Form.Item name="reason" label="缺货原因">
            <Input.TextArea placeholder="请输入缺货原因" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default OrdersPage
