import React, { useState, useEffect } from 'react'
import { Table, Button, Space, Modal, Form, Input, message, Tag, Descriptions } from 'antd'
import axios from 'axios'
import dayjs from 'dayjs'

function DuplicateDeductions() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [pagination.current, pagination.pageSize])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/transactions/duplicates', {
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

  const handleProcess = (record) => {
    setSelectedRecord(record)
    setModalVisible(true)
  }

  const handleProcessSubmit = async () => {
    try {
      const values = await form.validateFields()
      const res = await axios.post('/api/transactions/duplicates/handle', {
        dedup_id: selectedRecord.dedup_id,
        ...values,
        handler: 'admin'
      })
      if (res.data.success) {
        message.success('处理成功')
        setModalVisible(false)
        form.resetFields()
        loadData()
      }
    } catch (error) {
      message.error('处理失败')
    }
  }

  const columns = [
    { title: '记录ID', dataIndex: 'dedup_id', key: 'dedup_id', width: 180 },
    { title: '卡号', dataIndex: 'card_id', key: 'card_id' },
    { title: '学生姓名', dataIndex: 'student_name', key: 'student_name' },
    { title: '疑似金额', dataIndex: 'original_amount', key: 'original_amount', render: v => `¥${v}` },
    { title: '置信度', dataIndex: 'confidence', key: 'confidence', render: v => `${(v * 100).toFixed(1)}%` },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      render: v => {
        const colorMap = { detected: 'orange', resolved: 'green' }
        const labelMap = { detected: '待处理', resolved: '已处理' }
        return <Tag color={colorMap[v]}>{labelMap[v]}</Tag>
      }
    },
    { title: '检测时间', dataIndex: 'detected_time', key: 'detected_time', render: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => record.status === 'detected' && (
        <Button size="small" onClick={() => handleProcess(record)}>处理</Button>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>重复扣款处理</h2>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="dedup_id" 
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条`
        }}
        onChange={p => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
      />

      <Modal
        title="处理重复扣款"
        open={modalVisible}
        onOk={handleProcessSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        width={700}
      >
        {selectedRecord && (
          <Descriptions column={2} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="卡号">{selectedRecord.card_id}</Descriptions.Item>
            <Descriptions.Item label="学生姓名">{selectedRecord.student_name}</Descriptions.Item>
            <Descriptions.Item label="疑似金额" span={2}>¥{selectedRecord.original_amount}</Descriptions.Item>
            <Descriptions.Item label="匹配条件">{selectedRecord.match_criteria}</Descriptions.Item>
            <Descriptions.Item label="置信度">{(selectedRecord.confidence * 100).toFixed(1)}%</Descriptions.Item>
          </Descriptions>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="action" label="处理方式" rules={[{ required: true }]}>
            <Select>
              <Option value="refund">确认重复，退款处理</Option>
              <Option value="confirm_normal">正常交易，标记为正常</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="处理备注">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DuplicateDeductions
