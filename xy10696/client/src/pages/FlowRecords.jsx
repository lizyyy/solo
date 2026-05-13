import React, { useState, useEffect } from 'react'
import { Table, Tag, message } from 'antd'
import axios from 'axios'
import dayjs from 'dayjs'

function FlowRecords() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchRecords()
  }, [])

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/flow')
      setRecords(res.data)
    } catch (error) {
      message.error('获取流转记录失败')
    } finally {
      setLoading(false)
    }
  }

  const renderBeforeAfter = (data) => {
    if (!data) return '-'
    try {
      const parsed = JSON.parse(data)
      return (
        <div style={{ fontSize: 12 }}>
          {Object.entries(parsed).map(([key, value]) => (
            <div key={key}>{key}: {JSON.stringify(value)}</div>
          ))}
        </div>
      )
    } catch {
      return '-'
    }
  }

  const columns = [
    {
      title: '设备编号',
      dataIndex: 'device_number',
      key: 'device_number',
    },
    {
      title: '流转类型',
      dataIndex: 'flow_type',
      key: 'flow_type',
      filters: [
        { text: '创建', value: 'create' },
        { text: '更新', value: 'update' },
        { text: '租借', value: 'rent' },
        { text: '归还', value: 'return' },
        { text: '维修创建', value: 'repair_create' },
        { text: '维修完成', value: 'repair_complete' },
        { text: '押金变更', value: 'deposit_change' },
      ],
      onFilter: (value, record) => record.flow_type === value,
      render: (type) => {
        const colorMap = {
          create: 'green',
          update: 'blue',
          rent: 'cyan',
          return: 'purple',
          repair_create: 'orange',
          repair_complete: 'orange',
          deposit_change: 'magenta',
        }
        return <Tag color={colorMap[type] || 'default'}>{type}</Tag>
      },
    },
    {
      title: '变更前',
      dataIndex: 'before_data',
      key: 'before_data',
      render: renderBeforeAfter,
    },
    {
      title: '变更后',
      dataIndex: 'after_data',
      key: 'after_data',
      render: renderBeforeAfter,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2>流转记录</h2>
      </div>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  )
}

export default FlowRecords
