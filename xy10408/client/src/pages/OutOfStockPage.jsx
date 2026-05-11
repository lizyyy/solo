import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Select, InputNumber, Input, message, Space, Tag, Card, Row, Col, Radio, Divider } from 'antd'
import { PlusOutlined, CheckCircleOutlined, HistoryOutlined } from '@ant-design/icons'
import { orderApi, productApi, planApi } from '../utils/api'

const OutOfStockPage = () => {
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [planModalVisible, setPlanModalVisible] = useState(false)
  const [historyModalVisible, setHistoryModalVisible] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [plans, setPlans] = useState([])
  const [form] = Form.useForm()
  const [planType, setPlanType] = useState('exchange')

  const loadOrders = async () => {
    setLoading(true)
    try {
      const res = await orderApi.getAll({ status: 'out_of_stock' })
      setOrders(res.data)
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadProducts = async () => {
    try {
      const res = await productApi.getAll()
      setProducts(res.data)
    } catch (err) {
      message.error('加载商品失败')
    }
  }

  useEffect(() => {
    loadOrders()
    loadProducts()
  }, [])

  const handleCreatePlan = (order) => {
    setSelectedOrder(order)
    setPlanType('exchange')
    form.resetFields()
    form.setFieldsValue({ plan_type: 'exchange', target_quantity: 1, reason: '缺货' })
    setPlanModalVisible(true)
  }

  const handleViewHistory = async (order) => {
    try {
      const res = await orderApi.getPlans(order.id)
      setPlans(res.data)
      setSelectedOrder(order)
      setHistoryModalVisible(true)
    } catch (err) {
      message.error('加载方案失败')
    }
  }

  const handleSubmitPlan = async (values) => {
    try {
      await orderApi.createPlan(selectedOrder.id, values)
      message.success('方案创建成功')
      setPlanModalVisible(false)
      loadOrders()
    } catch (err) {
      message.error(err.response?.data?.error || '创建失败')
    }
  }

  const handleConfirmPlan = async (planId) => {
    try {
      await planApi.confirm(planId)
      message.success('方案已确认')
      loadOrders()
      if (historyModalVisible) {
        const res = await orderApi.getPlans(selectedOrder.id)
        setPlans(res.data)
      }
    } catch (err) {
      message.error(err.response?.data?.error || '确认失败')
    }
  }

  const getPlanTypeText = (type) => {
    const map = { exchange: '换货', refund: '退款', supplement: '补差' }
    return map[type] || type
  }

  const getPlanTypeColor = (type) => {
    const map = { exchange: 'blue', refund: 'orange', supplement: 'purple' }
    return map[type] || 'default'
  }

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 150
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
      title: '缺货商品',
      key: 'product',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.product_name}</span>
          <span style={{ fontSize: 12, color: '#999' }}>{record.product_specs} × {record.quantity}</span>
        </Space>
      )
    },
    {
      title: '实付金额',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 120,
      render: (amount) => `¥${amount?.toFixed(2)}`
    },
    {
      title: '拼团',
      dataIndex: 'group_name',
      key: 'group_name',
      width: 150
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => handleCreatePlan(record)}>
            生成方案
          </Button>
          <Button size="small" icon={<HistoryOutlined />} onClick={() => handleViewHistory(record)}>
            方案历史
          </Button>
        </Space>
      )
    }
  ]

  const planColumns = [
    {
      title: '方案类型',
      dataIndex: 'plan_type',
      key: 'plan_type',
      render: (type) => <Tag color={getPlanTypeColor(type)}>{getPlanTypeText(type)}</Tag>
    },
    {
      title: '目标商品',
      key: 'target',
      render: (_, record) => {
        if (record.plan_type === 'refund') return '-'
        return record.target_product ? `${record.target_product} ${record.target_specs || ''} × ${record.target_quantity || 1}` : '-'
      }
    },
    {
      title: '退款金额',
      dataIndex: 'refund_amount',
      key: 'refund_amount',
      render: (v) => v ? `¥${v.toFixed(2)}` : '-'
    },
    {
      title: '补款金额',
      dataIndex: 'supplement_amount',
      key: 'supplement_amount',
      render: (v) => v ? `¥${v.toFixed(2)}` : '-'
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => status === 'confirmed' ? <Tag color="green">已确认</Tag> : <Tag color="orange">待确认</Tag>
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => record.status === 'pending' ? (
        <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => handleConfirmPlan(record.id)}>
          确认方案
        </Button>
      ) : null
    }
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card className="stat-card">
            <div className="stat-number" style={{ color: '#ff4d4f' }}>{orders.length}</div>
            <div className="stat-label">待处理缺货订单</div>
          </Card>
        </Col>
      </Row>

      <div className="page-header">
        <h2 className="page-title">异常订单（缺货）</h2>
      </div>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title="生成补差方案"
        open={planModalVisible}
        onCancel={() => setPlanModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        {selectedOrder && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={4}>
              <span><strong>订单：</strong>{selectedOrder.order_no}</span>
              <span><strong>用户：</strong>{selectedOrder.user_name} ({selectedOrder.user_phone})</span>
              <span><strong>原商品：</strong>{selectedOrder.product_name} {selectedOrder.product_specs} × {selectedOrder.quantity}</span>
              <span><strong>实付金额：</strong>¥{selectedOrder.paid_amount?.toFixed(2)}</span>
            </Space>
          </Card>
        )}

        <Form form={form} onFinish={handleSubmitPlan} layout="vertical">
          <Form.Item name="plan_type" label="处理方式">
            <Radio.Group onChange={(e) => setPlanType(e.target.value)}>
              <Radio value="exchange">换货</Radio>
              <Radio value="refund">退款</Radio>
              <Radio value="supplement">补差</Radio>
            </Radio.Group>
          </Form.Item>

          {planType === 'exchange' && (
            <>
              <Divider style={{ margin: '12px 0' }}>换货设置</Divider>
              <Form.Item name="target_product_id" label="选择目标商品" rules={[{ required: true, message: '请选择商品' }]}>
                <Select
                  placeholder="请选择要换的商品"
                  options={products.map(p => ({
                    label: `${p.name} ${p.specs} (库存: ${p.stock}, ¥${p.price})`,
                    value: p.id
                  }))}
                />
              </Form.Item>
              <Form.Item name="target_quantity" label="数量" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}

          {planType === 'refund' && (
            <>
              <Divider style={{ margin: '12px 0' }}>退款设置</Divider>
              <Form.Item name="refund_amount" label="退款金额" rules={[{ required: true, message: '请输入退款金额' }]}>
                <InputNumber min={0} step={0.01} max={selectedOrder?.paid_amount || 999999} style={{ width: '100%' }} addonBefore="¥" />
              </Form.Item>
            </>
          )}

          {planType === 'supplement' && (
            <>
              <Divider style={{ margin: '12px 0' }}>补差设置</Divider>
              <Form.Item name="target_product_id" label="目标商品">
                <Select
                  placeholder="可选，选择新规格商品"
                  options={products.map(p => ({
                    label: `${p.name} ${p.specs} (¥${p.price})`,
                    value: p.id
                  }))}
                />
              </Form.Item>
              <Form.Item name="target_quantity" label="数量">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="supplement_amount" label="补款金额">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} addonBefore="¥" />
              </Form.Item>
            </>
          )}

          <Form.Item name="reason" label="原因" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="方案历史"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedOrder && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={4}>
              <span><strong>订单：</strong>{selectedOrder.order_no}</span>
              <span><strong>用户：</strong>{selectedOrder.user_name} ({selectedOrder.user_phone})</span>
            </Space>
          </Card>
        )}
        <Table
          columns={planColumns}
          dataSource={plans}
          rowKey="id"
          pagination={false}
        />
      </Modal>
    </div>
  )
}

export default OutOfStockPage
