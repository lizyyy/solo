import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, message, Tag } from 'antd'
import { PlusOutlined, CheckOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'

const { Option } = Select

function Repairs() {
  const [repairs, setRepairs] = useState([])
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchRepairs()
    fetchAllDevices()
  }, [])

  const fetchRepairs = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/repairs')
      setRepairs(res.data)
    } catch (error) {
      message.error('获取维修记录失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllDevices = async () => {
    try {
      const res = await axios.get('/api/devices')
      setDevices(res.data)
    } catch (error) {
      console.error('获取设备列表失败:', error)
    }
  }

  const handleAdd = () => {
    form.resetFields()
    setModalVisible(true)
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const device = devices.find(d => d.id === values.device_id)
      await axios.post('/api/repairs', { 
        ...values, 
        device_number: device?.device_number,
        operator: '管理员' 
      })
      message.success('添加成功')
      setModalVisible(false)
      fetchRepairs()
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败')
    }
  }

  const handleComplete = async (id) => {
    try {
      await axios.put(`/api/repairs/${id}`, { repair_status: 'completed', operator: '管理员' })
      message.success('维修完成')
      fetchRepairs()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const columns = [
    {
      title: '设备编号',
      dataIndex: 'device_number',
      key: 'device_number',
    },
    {
      title: '问题描述',
      dataIndex: 'issue_description',
      key: 'issue_description',
    },
    {
      title: '状态',
      dataIndex: 'repair_status',
      key: 'repair_status',
      filters: [
        { text: '待处理', value: 'pending' },
        { text: '处理中', value: 'in_progress' },
        { text: '已完成', value: 'completed' },
      ],
      onFilter: (value, record) => record.repair_status === value,
      render: (status) => {
        const colorMap = {
          pending: 'red',
          in_progress: 'orange',
          completed: 'green',
        }
        const textMap = {
          pending: '待处理',
          in_progress: '处理中',
          completed: '已完成',
        }
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>
      },
    },
    {
      title: '责任人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    {
      title: '维修时间',
      dataIndex: 'repair_time',
      key: 'repair_time',
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        record.repair_status !== 'completed' && (
          <Button 
            type="primary" 
            size="small" 
            icon={<CheckOutlined />} 
            onClick={() => handleComplete(record.id)}
          >
            完成
          </Button>
        )
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>维修记录</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加维修
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={repairs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="添加维修记录"
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="device_id"
            label="选择设备"
            rules={[{ required: true, message: '请选择设备' }]}
          >
            <Select placeholder="请选择设备">
              {devices.map(device => (
                <Option key={device.id} value={device.id}>
                  {device.device_number} - {device.language_pack}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="issue_description"
            label="问题描述"
            rules={[{ required: true, message: '请输入问题描述' }]}
          >
            <Input.TextArea placeholder="请描述设备问题" rows={3} />
          </Form.Item>
          <Form.Item
            name="responsible_person"
            label="责任人"
          >
            <Input placeholder="请输入责任人" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Repairs
