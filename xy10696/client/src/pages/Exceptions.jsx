import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, message, Select } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'

const { Option } = Select

function Exceptions() {
  const [exceptions, setExceptions] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchExceptions()
  }, [])

  const fetchExceptions = async (params = {}) => {
    setLoading(true)
    try {
      const res = await axios.get('/api/exceptions', { params })
      setExceptions(res.data)
    } catch (error) {
      message.error('获取异常列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (id) => {
    try {
      await axios.put(`/api/exceptions/${id}`, { status: 'resolved', operator: '管理员' })
      message.success('已标记为已解决')
      fetchExceptions()
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
      title: '异常类型',
      dataIndex: 'exception_type',
      key: 'exception_type',
      filters: [
        { text: '电量过低', value: 'low_battery' },
        { text: '租借时电量低', value: 'low_battery_rent' },
        { text: '归还时电量低', value: 'low_battery_return' },
        { text: '发现损坏', value: 'damage_found' },
      ],
      onFilter: (value, record) => record.exception_type === value,
      render: (type) => {
        const colorMap = {
          low_battery: 'orange',
          low_battery_rent: 'orange',
          low_battery_return: 'orange',
          damage_found: 'red',
        }
        return <Tag color={colorMap[type] || 'blue'}>{type}</Tag>
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: '待处理', value: 'pending' },
        { text: '已解决', value: 'resolved' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => (
        <Tag color={status === 'pending' ? 'red' : 'green'}>
          {status === 'pending' ? '待处理' : '已解决'}
        </Tag>
      ),
    },
    {
      title: '责任人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
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
        record.status === 'pending' && (
          <Button 
            type="primary" 
            size="small" 
            icon={<CheckOutlined />} 
            onClick={() => handleResolve(record.id)}
          >
            解决
          </Button>
        )
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>异常管理</h2>
        <Select
          placeholder="按状态筛选"
          style={{ width: 120 }}
          onChange={(value) => fetchExceptions({ status: value })}
          allowClear
        >
          <Option value="pending">待处理</Option>
          <Option value="resolved">已解决</Option>
        </Select>
      </div>

      <Table
        columns={columns}
        dataSource={exceptions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  )
}

export default Exceptions
