import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, InputNumber, message } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'

const { Option } = Select

function Devices() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingDevice, setEditingDevice] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchDevices()
  }, [])

  const fetchDevices = async (params = {}) => {
    setLoading(true)
    try {
      const res = await axios.get('/api/devices', { params })
      setDevices(res.data)
    } catch (error) {
      message.error('获取设备列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingDevice(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingDevice(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      if (editingDevice) {
        await axios.put(`/api/devices/${editingDevice.id}`, { ...values, operator: '管理员' })
        message.success('更新成功')
      } else {
        await axios.post('/api/devices', { ...values, operator: '管理员' })
        message.success('添加成功')
      }
      setModalVisible(false)
      fetchDevices()
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败')
    }
  }

  const columns = [
    {
      title: '设备编号',
      dataIndex: 'device_number',
      key: 'device_number',
      sorter: (a, b) => a.device_number.localeCompare(b.device_number),
    },
    {
      title: '语言包',
      dataIndex: 'language_pack',
      key: 'language_pack',
      filters: [
        { text: '中文', value: '中文' },
        { text: '英文', value: '英文' },
        { text: '日语', value: '日语' },
        { text: '韩语', value: '韩语' },
        { text: '法语', value: '法语' },
        { text: '德语', value: '德语' },
      ],
      onFilter: (value, record) => record.language_pack === value,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: '可用', value: 'available' },
        { text: '已租借', value: 'rented' },
        { text: '维修中', value: 'repairing' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        const colorMap = {
          available: 'green',
          rented: 'blue',
          repairing: 'red',
        }
        const textMap = {
          available: '可用',
          rented: '已租借',
          repairing: '维修中',
        }
        return <Select
          value={status}
          style={{ width: 100 }}
          onChange={async (value) => {
            await axios.put(`/api/devices/${status.id}`, { status: value, operator: '管理员' })
            fetchDevices()
          }}
        >
          <Option value="available">可用</Option>
          <Option value="rented">已租借</Option>
          <Option value="repairing">维修中</Option>
        </Select>
      },
    },
    {
      title: '电量',
      dataIndex: 'battery_level',
      key: 'battery_level',
      render: (level) => `${level}%`,
      sorter: (a, b) => a.battery_level - b.battery_level,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>设备管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加设备
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={devices}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingDevice ? '编辑设备' : '添加设备'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="device_number"
            label="设备编号"
            rules={[{ required: true, message: '请输入设备编号' }]}
          >
            <Input placeholder="请输入设备编号" disabled={!!editingDevice} />
          </Form.Item>
          <Form.Item
            name="language_pack"
            label="语言包"
            rules={[{ required: true, message: '请选择语言包' }]}
          >
            <Select placeholder="请选择语言包">
              <Option value="中文">中文</Option>
              <Option value="英文">英文</Option>
              <Option value="日语">日语</Option>
              <Option value="韩语">韩语</Option>
              <Option value="法语">法语</Option>
              <Option value="德语">德语</Option>
            </Select>
          </Form.Item>
          {editingDevice && (
            <>
              <Form.Item name="status" label="状态">
                <Select>
                  <Option value="available">可用</Option>
                  <Option value="rented">已租借</Option>
                  <Option value="repairing">维修中</Option>
                </Select>
              </Form.Item>
              <Form.Item name="battery_level" label="电量">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default Devices
