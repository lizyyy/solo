import React, { useState, useEffect } from 'react'
import { Table, Button, Input, Space, Modal, Form, Select, message, Tag } from 'antd'
import axios from 'axios'
import dayjs from 'dayjs'

const { Option } = Select

function Cards() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [filters, setFilters] = useState({})
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState('create')
  const [selectedCard, setSelectedCard] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [pagination.current, pagination.pageSize, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/cards', {
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

  const columns = [
    { title: '卡号', dataIndex: 'card_id', key: 'card_id' },
    { title: '学号', dataIndex: 'student_id', key: 'student_id' },
    { title: '姓名', dataIndex: 'student_name', key: 'student_name' },
    { title: '余额', dataIndex: 'balance', key: 'balance', render: v => `¥${v}` },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      render: v => {
        const colorMap = { normal: 'green', frozen: 'red', lost: 'orange' }
        const labelMap = { normal: '正常', frozen: '冻结', lost: '挂失' }
        return <Tag color={colorMap[v]}>{labelMap[v]}</Tag>
      }
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => handleFreeze(record)} disabled={record.status === 'frozen'}>冻结</Button>
          <Button size="small" onClick={() => handleUnfreeze(record)} disabled={record.status !== 'frozen'}>解冻</Button>
          <Button size="small" onClick={() => handleReportLost(record)} disabled={record.status === 'lost'}>挂失</Button>
        </Space>
      )
    }
  ]

  const handleFreeze = (record) => {
    setSelectedCard(record)
    setModalType('freeze')
    setModalVisible(true)
  }

  const handleUnfreeze = (record) => {
    setSelectedCard(record)
    setModalType('unfreeze')
    setModalVisible(true)
  }

  const handleReportLost = (record) => {
    setSelectedCard(record)
    setModalType('lost')
    setModalVisible(true)
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      const apiMap = {
        create: '/api/cards',
        freeze: '/api/cards/freeze',
        unfreeze: '/api/cards/unfreeze',
        lost: '/api/cards/lost'
      }

      const res = await axios.post(apiMap[modalType], {
        ...values,
        card_id: selectedCard?.card_id,
        operator: 'admin'
      })

      if (res.data.success) {
        message.success('操作成功')
        setModalVisible(false)
        form.resetFields()
        loadData()
      }
    } catch (error) {
      message.error(error.response?.data?.message || '操作失败')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>餐卡管理</h2>
        <Space>
          <Input.Search 
            placeholder="搜索学号" 
            onSearch={v => setFilters({ ...filters, student_id: v })}
            style={{ width: 200 }}
          />
          <Select 
            placeholder="状态筛选" 
            allowClear 
            style={{ width: 120 }}
            onChange={v => setFilters({ ...filters, status: v })}
          >
            <Option value="normal">正常</Option>
            <Option value="frozen">冻结</Option>
            <Option value="lost">挂失</Option>
          </Select>
          <Button type="primary" onClick={() => { setModalType('create'); setModalVisible(true); }}>
            新餐卡
          </Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="card_id" 
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条`
        }}
        onChange={p => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
      />

      <Modal
        title={{ create: '新餐卡', freeze: '冻结餐卡', unfreeze: '解冻餐卡', lost: '挂失餐卡' }[modalType]}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
      >
        <Form form={form} layout="vertical">
          {modalType === 'create' && (
            <>
              <Form.Item name="card_id" label="卡号" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="student_id" label="学号" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="student_name" label="姓名" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="balance" label="初始余额">
                <Input type="number" />
              </Form.Item>
            </>
          )}
          {(modalType === 'freeze' || modalType === 'lost') && (
            <Form.Item name="reason" label="原因" rules={[{ required: true }]}>
              <Input.TextArea />
            </Form.Item>
          )}
          {modalType === 'unfreeze' && (
            <Form.Item name="reason" label="解冻原因" rules={[{ required: true }]}>
              <Input.TextArea />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default Cards
