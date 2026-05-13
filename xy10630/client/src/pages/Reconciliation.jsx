import React, { useState, useEffect } from 'react'
import { Table, Button, Space, Modal, Form, Input, DatePicker, Select, message, Tag } from 'antd'
import axios from 'axios'
import dayjs from 'dayjs'

const { Option } = Select

function Reconciliation() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [pagination.current, pagination.pageSize])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/reconciliation', {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize
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

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      const res = await axios.post('/api/reconciliation', {
        ...values,
        recon_date: values.recon_date.format('YYYY-MM-DD'),
        operator: 'admin'
      })
      if (res.data.success) {
        message.success('对账记录创建成功')
        setModalVisible(false)
        form.resetFields()
        loadData()
      }
    } catch (error) {
      message.error('创建失败')
    }
  }

  const columns = [
    { title: '对账ID', dataIndex: 'recon_id', key: 'recon_id', width: 180 },
    { title: '食堂名称', dataIndex: 'canteen_name', key: 'canteen_name' },
    { title: '对账日期', dataIndex: 'recon_date', key: 'recon_date', render: v => dayjs(v).format('YYYY-MM-DD') },
    { title: '上报笔数', dataIndex: 'total_transactions', key: 'total_transactions' },
    { title: '上报金额', dataIndex: 'total_amount', key: 'total_amount', render: v => `¥${v}` },
    { title: '系统金额', dataIndex: 'system_amount', key: 'system_amount', render: v => `¥${v}` },
    { title: '差额', dataIndex: 'difference', key: 'difference', render: v => <span style={{ color: v !== 0 ? 'red' : 'green' }}>¥{v}</span> },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      render: v => {
        const colorMap = { matched: 'green', mismatch: 'red', pending: 'orange' }
        const labelMap = { matched: '匹配', mismatch: '不匹配', pending: '待处理' }
        return <Tag color={colorMap[v]}>{labelMap[v]}</Tag>
      }
    },
    { title: '操作员', dataIndex: 'operator', key: 'operator' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: v => dayjs(v).format('YYYY-MM-DD HH:mm') }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>食堂对账</h2>
        <Space>
          <Button type="primary" onClick={() => setModalVisible(true)}>新建对账</Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="recon_id" 
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条`
        }}
        onChange={p => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
      />

      <Modal
        title="新建对账记录"
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="canteen_id" label="食堂" rules={[{ required: true }]}>
            <Select>
              <Option value="CAN001">第一食堂</Option>
              <Option value="CAN002">第二食堂</Option>
              <Option value="CAN003">第三食堂</Option>
            </Select>
          </Form.Item>
          <Form.Item name="canteen_name" label="食堂名称" rules={[{ required: true }]}>
            <Select>
              <Option value="第一食堂">第一食堂</Option>
              <Option value="第二食堂">第二食堂</Option>
              <Option value="第三食堂">第三食堂</Option>
            </Select>
          </Form.Item>
          <Form.Item name="recon_date" label="对账日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="total_transactions" label="上报笔数" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="total_amount" label="上报金额" rules={[{ required: true }]}>
            <Input type="number" step="0.01" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Reconciliation
