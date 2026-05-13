import React, { useState, useEffect } from 'react'
import { Table, Button, Input, Space, Select, DatePicker, message, Tag } from 'antd'
import { ExportOutlined } from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'

const { Option } = Select
const { RangePicker } = DatePicker

function AuditLogs() {
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
      const res = await axios.get('/api/reconciliation/audit', {
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
    const params = new URLSearchParams({ type: 'audit', ...filters }).toString()
    window.open(`/api/reconciliation/export?${params}`, '_blank')
  }

  const columns = [
    { title: '日志ID', dataIndex: 'log_id', key: 'log_id', width: 180 },
    { title: '操作类型', dataIndex: 'operation_type', key: 'operation_type' },
    { title: '实体类型', dataIndex: 'entity_type', key: 'entity_type' },
    { title: '实体ID', dataIndex: 'entity_id', key: 'entity_id' },
    { title: '操作员', dataIndex: 'operator', key: 'operator' },
    { 
      title: '结果', 
      dataIndex: 'result', 
      key: 'result', 
      render: v => {
        const colorMap = { success: 'green', failed: 'red' }
        const labelMap = { success: '成功', failed: '失败' }
        return <Tag color={colorMap[v]}>{labelMap[v]}</Tag>
      }
    },
    { title: '失败原因', dataIndex: 'fail_reason', key: 'fail_reason' },
    { title: '操作时间', dataIndex: 'created_at', key: 'created_at', render: v => dayjs(v).format('YYYY-MM-DD HH:mm:ss') }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>审计日志</h2>
        <Space>
          <Select 
            placeholder="操作类型" 
            allowClear 
            style={{ width: 120 }}
            onChange={v => setFilters({ ...filters, operation_type: v })}
          >
            <Option value="create">创建</Option>
            <Option value="freeze">冻结</Option>
            <Option value="unfreeze">解冻</Option>
            <Option value="lost">挂失</Option>
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
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="log_id" 
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

export default AuditLogs
