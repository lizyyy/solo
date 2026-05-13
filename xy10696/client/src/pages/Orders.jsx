import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, InputNumber, message, Space, Tag } from 'antd'
import { PlusOutlined, ArrowUpOutlined, CheckOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'

const { Option } = Select

function Orders() {
  const [orders, setOrders] = useState([])
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [rentModalVisible, setRentModalVisible] = useState(false)
  const [returnModalVisible, setReturnModalVisible] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [rentForm] = Form.useForm()
  const [returnForm] = Form.useForm()

  useEffect(() => {
    fetchOrders()
    fetchAvailableDevices()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/orders')
      setOrders(res.data)
    } catch (error) {
      message.error('获取订单列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableDevices = async () => {
    try {
      const res = await axios.get('/api/devices', { params: { status: 'available' } })
      setDevices(res.data)
    } catch (error) {
      console.error('获取可用设备失败:', error)
    }
  }

  const handleRent = () => {
    rentForm.resetFields()
    setRentModalVisible(true)
  }

  const handleReturn = (record) => {
    setSelectedOrder(record)
    returnForm.resetFields()
    returnForm.setFieldsValue({ battery_level: 80, inspection_result: 'pass' })
    setReturnModalVisible(true)
  }

  const handleRentOk = async () => {
    try {
      const values = await rentForm.validateFields()
      await axios.post('/api/orders/rent', { ...values, operator: '管理员' })
      message.success('租借成功')
      setRentModalVisible(false)
      fetchOrders()
      fetchAvailableDevices()
    } catch (error) {
      message.error(error.response?.data?.error || '租借失败')
    }
  }

  const handleReturnOk = async () => {
    try {
      const values = await returnForm.validateFields()
      await axios.post('/api/orders/return', { 
        order_id: selectedOrder.id,
        ...values, 
        operator: '管理员' 
      })
      message.success('归还成功')
      setReturnModalVisible(false)
      fetchOrders()
      fetchAvailableDevices()
    } catch (error) {
      message.error(error.response?.data?.error || '归还失败')
    }
  }

  const columns = [
    {
      title: '订单编号',
      dataIndex: 'id',
      key: 'id',
      render: (id) => id.slice(0, 8),
    },
    {
      title: '设备编号',
      dataIndex: 'device_number',
      key: 'device_number',
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: '客户电话',
      dataIndex: 'customer_phone',
      key: 'customer_phone',
    },
    {
      title: '押金金额',
      dataIndex: 'deposit_amount',
      key: 'deposit_amount',
      render: (amount) => `¥${amount}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: '进行中', value: 'active' },
        { text: '已完成', value: 'completed' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => (
        <Tag color={status === 'active' ? 'blue' : 'green'}>
          {status === 'active' ? '进行中' : '已完成'}
        </Tag>
      ),
    },
    {
      title: '租借时间',
      dataIndex: 'rental_time',
      key: 'rental_time',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '归还时间',
      dataIndex: 'return_time',
      key: 'return_time',
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        record.status === 'active' && (
          <Button 
            type="primary" 
            size="small" 
            icon={<CheckOutlined />} 
            onClick={() => handleReturn(record)}
          >
            归还
          </Button>
        )
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>订单管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleRent}>
          新建租借
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="新建租借"
        open={rentModalVisible}
        onOk={handleRentOk}
        onCancel={() => setRentModalVisible(false)}
        width={600}
      >
        <Form form={rentForm} layout="vertical">
          <Form.Item
            name="device_id"
            label="选择设备"
            rules={[{ required: true, message: '请选择设备' }]}
          >
            <Select placeholder="请选择可用设备">
              {devices.map(device => (
                <Option key={device.id} value={device.id}>
                  {device.device_number} - {device.language_pack} (电量: {device.battery_level}%)
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="customer_name"
            label="客户姓名"
            rules={[{ required: true, message: '请输入客户姓名' }]}
          >
            <Input placeholder="请输入客户姓名" />
          </Form.Item>
          <Form.Item
            name="customer_phone"
            label="客户电话"
            rules={[{ required: true, message: '请输入客户电话' }]}
          >
            <Input placeholder="请输入客户电话" />
          </Form.Item>
          <Form.Item
            name="deposit_amount"
            label="押金金额"
            rules={[{ required: true, message: '请输入押金金额' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入押金金额" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="设备归还"
        open={returnModalVisible}
        onOk={handleReturnOk}
        onCancel={() => setReturnModalVisible(false)}
        width={600}
      >
        <Form form={returnForm} layout="vertical">
          <Form.Item label="设备信息">
            <div>设备编号: {selectedOrder?.device_number}</div>
            <div>客户姓名: {selectedOrder?.customer_name}</div>
          </Form.Item>
          <Form.Item
            name="battery_level"
            label="归还电量"
            rules={[{ required: true, message: '请输入归还电量' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="请输入归还电量" />
          </Form.Item>
          <Form.Item
            name="inspection_result"
            label="验收结果"
            rules={[{ required: true, message: '请选择验收结果' }]}
          >
            <Select>
              <Option value="pass">正常</Option>
              <Option value="fail">损坏</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="damage_description"
            label="损坏描述"
          >
            <Input.TextArea placeholder="如有损坏，请描述具体情况" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Orders
