import React, { useState, useEffect } from 'react'
import { Table, Button, Input, Space, Select, DatePicker, Upload, message, Tag } from 'antd'
import { UploadOutlined, ExportOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'

const { Option } = Select
const { RangePicker } = DatePicker

function Transactions() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [filters, setFilters] = useState({})

  useEffect(() => {
    loadData()
  }, [pagination.current, pagination.pageSize, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/transactions', {
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
    const params = new URLSearchParams({ type: 'transactions', ...filters }).toString()
    window.open(`/api/reconciliation/export?${params}`, '_blank')
  }

  const uploadProps = {
    name: 'file',
    action: '/api/import/transactions',
    data: { operator: 'admin' },
    onChange(info) {
      if (info.file.status === 'done') {
        message.success(info.file.response.message)
        loadData()
      } else if (info.file.status === 'error') {
        message.error('导入失败')
      }
    }
  }

  const columns = [
    { title: '交易ID', dataIndex: 'tx_id', key: 'tx_id', width: 180 },
    { title: '卡号', dataIndex: 'card_id', key: 'card_id', width: 100 },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: v => `¥${v}` },
    { title: '食堂', dataIndex: 'canteen_name', key: 'canteen_name' },
    { title: '设备号', dataIndex: 'device_id', key: 'device_id' },
    { title: '交易时间', dataIndex: 'tx_time', key: 'tx_time', render: v => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      render: v => {
        const colorMap = { completed: 'green', invalid: 'red', refunded: 'orange' }
        const labelMap = { completed: '正常', invalid: '无效', refunded: '已退款' }
        return <Tag color={colorMap[v]}>{labelMap[v]}</Tag>
      }
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>交易记录</h2>
        <Space>
          <Input.Search 
            placeholder="卡号" 
            onSearch={v => setFilters({ ...filters, card_id: v })}
            style={{ width: 150 }}
          />
          <Select 
            placeholder="食堂" 
            allowClear 
            style={{ width: 120 }}
            onChange={v => setFilters({ ...filters, canteen_id: v })}
          >
            <Option value="CAN001">第一食堂</Option>
            <Option value="CAN002">第二食堂</Option>
            <Option value="CAN003">第三食堂</Option>
          </Select>
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
          <Upload {...uploadProps} showUploadList={false}>
            <Button icon={<UploadOutlined />}>批量导入</Button>
          </Upload>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="tx_id" 
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条`
        }}
        onChange={p => setPagination({ ...pagination, current: p.current, pageSize: p.pageSize })}
      />
    </div>
  )
}

export default Transactions
