import React, { useState, useEffect } from 'react'
import { Table, Button, Input, Space, Modal, Form, Select, message, Tag } from 'antd'
import axios from 'axios'
import dayjs from 'dayjs'

const { Option } = Select

function Refund() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [filters, setFilters] = useState({})
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedRefund, setSelectedRefund] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [pagination.current, pagination.pageSize, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/refund', {
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

  const handleReview = (record) => {
    setSelectedRefund(record)
    setModalVisible(true)
  }

  const handleReviewSubmit = async () => {
    try {
      const values = await form.validateFields()
      const res = await axios.post('/api/refund/review', {
        refund_id: selectedRefund.refund_id,
        ...values,
        reviewer: 'admin'
      })
      if (res.data.success) {
        message.success('审核成功')
        setModalVisible(false)
        form.resetFields()
        loadData()
      }
    } catch (error) {
      message.error('审核失败')
    }
  }

  const columns = [
    { title: '退款ID', dataIndex: 'refund_id', key: 'refund_id', width: 180 },
    { title: '卡号', dataIndex: 'card_id', key: 'card_id' },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: v => `¥${v}` },
    { title: '退款类型', dataIndex: 'refund_type', key: 'refund_type' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      render: v => {
        const colorMap = { pending: 'orange', approved: 'green', rejected: 'red' }
        const labelMap = { pending: '待审核', approved: '已批准', rejected: '已拒绝' }
        return <Tag color={colorMap[v]}>{labelMap[v]}</Tag>
      }
    },
    { title: '申请人', dataIndex: 'operator', key: 'operator' },
    { title: '申请时间', dataIndex: 'created_at', key: 'created_at', render: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => record.status === 'pending' && (
        <Button size="small" onClick={() => handleReview(record)}>审核</Button>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>退款管理</h2>
        <Space>
          <Input.Search 
            placeholder="卡号" 
            onSearch={v => setFilters({ ...filters, card_id: v })}
            style={{ width: 150 }}
          />
          <Select 
            placeholder="状态" 
            allowClear 
            style={{ width: 120 }}
            onChange={v => setFilters({ ...filters, status: v })}
          >
            <Option value="pending">待审核</Option>
            <Option value="approved">已批准</Option>
            <Option value="rejected">已拒绝</Option>
          </Select>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="refund_id" 
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条`
        }}
        onChange={p => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
      />

      <Modal
        title="审核退款"
        open={modalVisible}
        onOk={handleReviewSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
      >
        {selectedRefund && (
          <div style={{ marginBottom: 16 }}>
            <p>卡号: {selectedRefund.card_id}</p>
            <p>金额: ¥{selectedRefund.amount}</p>
            <p>原因: {selectedRefund.reason}</p>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="action" label="审核结果" rules={[{ required: true }]}>
            <Select>
              <Option value="approve">通过</Option>
              <Option value="reject">拒绝</Option>
            </Select>
          </Form.Item>
          <Form.Item name="review_remark" label="审核意见">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Refund
