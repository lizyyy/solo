import React, { useState, useEffect } from 'react'
import { Table, Button, Input, Space, Modal, Form, Select, DatePicker, message, Tag } from 'antd'
import { ExportOutlined, PlusOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'

const { Option } = Select
const { RangePicker } = DatePicker

function Recharge() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [filters, setFilters] = useState({})
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [pagination.current, pagination.pageSize, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/recharge', {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize,
          ...filters
        }
      })
      if (res.data.success) {
        setData(res.data.data)
        setPagination({ ...pagination, total: res.data.total })
      }
    } catch (error) {
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams({ type: 'recharge', ...filters }).toString()
    window.open(`/api/reconciliation/export?${params}`, '_blank')
  }

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      const res = await axios.post('/api/recharge', {
        ...values,
        recharge_type: 'manual',
        operator: 'admin'
      })
      if (res.data.success) {
        message.success('充值成功')
        setModalVisible(false)
        form.resetFields()
        loadData()
      }
    } catch (error) {
      message.error(error.response?.data?.message || '充值失败')
    }
  }

  const columns = [
    { title: '订单ID', dataIndex: 'order_id', key: 'order_id', width: 180 },
    { title: '卡号', dataIndex: 'card_id', key: 'card_id' },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: v => `¥${v}` },
    { title: '充值类型', dataIndex: 'recharge_type', key: 'recharge_type' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      render: v => <Tag color="green">{v === 'completed' ? '已完成' : v}</Tag>
    },
    { title: '操作员', dataIndex: 'operator', key: 'operator' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: v => dayjs(v).format('YYYY-MM-DD HH:mm') }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>充值订单</h2>
        <Space>
          <Input.Search 
            placeholder="卡号" 
            onSearch={v => setFilters({ ...filters, card_id: v })}
            style={{ width: 150 }}
          />
          <RangePicker 
            onChange={(dates) => {
              if (dates) {
                setFilters({ 
                  ...filters, 
                  start_date: dates[0].format('YYYY-MM-DD'), 
                  end_date: dates[1].format('YYYY-MM-DD') 
                })
              }
            }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            人工充值
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="order_id" 
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条`
        }}
        onChange={p => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
      />

      <Modal
        title="人工充值"
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="card_id" label="卡号" rules={[{ required: true }]}>
            <Input placeholder="输入卡号，如 C001" />
          </Form.Item>
          <Form.Item name="amount" label="充值金额" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Recharge
