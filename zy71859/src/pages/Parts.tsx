import { useState } from 'react'
import { Table, Card, Input, Tag, Button, Space, Badge } from 'antd'
import { Search, ArrowLeft, Package } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store'
import type { ColumnsType } from 'antd/es/table'
import type { Part } from '@/types'
import dayjs from 'dayjs'

export default function Parts() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const { parts, records } = useAppStore()
  const [searchText, setSearchText] = useState('')

  const filteredParts = parts.filter((part) => {
    if (!searchText) return true
    const search = searchText.toLowerCase()
    return (
      part.name.toLowerCase().includes(search) ||
      part.type.toLowerCase().includes(search) ||
      part.specification.toLowerCase().includes(search)
    )
  })

  const getRecordCount = (partId: string) => {
    return records.filter((r) => r.partId === partId).length
  }

  const getQuantityStatus = (quantity: number) => {
    if (quantity < 20) return { status: 'error', text: '库存不足' }
    if (quantity < 50) return { status: 'warning', text: '库存紧张' }
    return { status: 'success', text: '库存充足' }
  }

  const columns: ColumnsType<Part> = [
    {
      title: '零件名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
            <Package size={16} className="text-primary-500" />
          </div>
          <span className={highlightId === record.id ? 'font-bold text-primary-500' : ''}>
            {text}
          </span>
          {highlightId === record.id && <Tag color="blue">当前关联</Tag>}
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => <Tag>{type}</Tag>,
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
    },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      render: (quantity, record) => {
        const { status, text } = getQuantityStatus(quantity)
        return (
          <Space>
            <Badge status={status as any} />
            <span className="font-medium">{quantity}</span>
            <span className="text-xs text-gray-400">({text})</span>
          </Space>
        )
      },
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: '关联练习',
      key: 'recordCount',
      width: 100,
      render: (_, record) => (
        <span className="text-primary-500 cursor-pointer hover:underline"
          onClick={() => navigate(`/records?partId=${record.id}`)}
        >
          {getRecordCount(record.id)} 条
        </span>
      ),
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
    },
    {
      title: '入库时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {highlightId && (
          <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/records')}>
            返回记录
          </Button>
        )}
        <h2 className="text-xl font-semibold text-gray-800">零件清单</h2>
      </div>

      <Card bordered={false} className="stat-card">
        <div className="flex items-center gap-3 mb-4">
          <Input
            placeholder="搜索零件名称/类型/规格"
            prefix={<Search size={16} className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <div className="flex-1" />
          <div className="text-sm text-gray-500">
            共 <span className="font-semibold text-gray-800">{filteredParts.length}</span> 种零件
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredParts}
          rowKey="id"
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 种零件`,
          }}
          size="middle"
        />
      </Card>
    </div>
  )
}
