import React, { useState, useEffect } from 'react'
import { Table, Card, Row, Col, Select, message, Tag, Space, Button, Descriptions } from 'antd'
import { DownloadOutlined, FileTextOutlined } from '@ant-design/icons'
import { compensationApi, groupApi } from '../utils/api'

const CompensationPage = () => {
  const [summary, setSummary] = useState(null)
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadGroups = async () => {
    try {
      const res = await groupApi.getAll()
      setGroups(res.data)
    } catch (err) {
      message.error('加载拼团失败')
    }
  }

  const loadSummary = async () => {
    setLoading(true)
    try {
      const res = await compensationApi.getSummary(selectedGroup)
      setSummary(res.data)
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  useEffect(() => {
    loadSummary()
  }, [selectedGroup])

  const getPlanTypeText = (type) => {
    const map = { exchange: '换货', refund: '退款', supplement: '补差' }
    return map[type] || type
  }

  const getPlanTypeColor = (type) => {
    const map = { exchange: 'blue', refund: 'orange', supplement: 'purple' }
    return map[type] || 'default'
  }

  const columns = [
    {
      title: '拼团',
      dataIndex: 'group_name',
      key: 'group_name',
      width: 150
    },
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 150
    },
    {
      title: '用户',
      key: 'user',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.user_name}</span>
          <span style={{ fontSize: 12, color: '#999' }}>{record.user_phone}</span>
        </Space>
      )
    },
    {
      title: '原商品',
      key: 'original',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.original_product}</span>
          <span style={{ fontSize: 12, color: '#999' }}>{record.original_specs}</span>
        </Space>
      )
    },
    {
      title: '处理方式',
      dataIndex: 'plan_type',
      key: 'plan_type',
      width: 100,
      render: (type) => <Tag color={getPlanTypeColor(type)}>{getPlanTypeText(type)}</Tag>
    },
    {
      title: '目标商品',
      key: 'target',
      render: (_, record) => {
        if (record.plan_type === 'refund') return '-'
        return record.target_product ? `${record.target_product} ${record.target_specs || ''} × ${record.target_quantity || 1}` : '-'
      }
    },
    {
      title: '退款',
      dataIndex: 'refund_amount',
      key: 'refund_amount',
      width: 100,
      render: (v) => v ? <span style={{ color: '#ff4d4f' }}>¥{v.toFixed(2)}</span> : '-'
    },
    {
      title: '补款',
      dataIndex: 'supplement_amount',
      key: 'supplement_amount',
      width: 100,
      render: (v) => v ? <span style={{ color: '#52c41a' }}>¥{v.toFixed(2)}</span> : '-'
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => status === 'confirmed' ? <Tag color="green">已确认</Tag> : <Tag color="orange">待确认</Tag>
    }
  ]

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">补差明细</h2>
        <Space>
          <Select
            placeholder="按拼团筛选"
            style={{ width: 250 }}
            allowClear
            value={selectedGroup}
            onChange={setSelectedGroup}
            options={groups.map(g => ({ label: g.name, value: g.id }))}
          />
          {selectedGroup && (
            <>
              <Button icon={<FileTextOutlined />} onClick={() => window.open(compensationApi.exportLeaderSummary(selectedGroup), '_blank')}>
                导出团长汇总
              </Button>
              <Button type="primary" icon={<DownloadOutlined />} onClick={() => window.open(compensationApi.exportExcel(selectedGroup), '_blank')}>
                导出Excel
              </Button>
            </>
          )}
        </Space>
      </div>

      {summary && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card className="stat-card">
              <div className="stat-number">{summary.total}</div>
              <div className="stat-label">方案总数</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="stat-card">
              <div className="stat-number" style={{ color: '#52c41a' }}>{summary.confirmed}</div>
              <div className="stat-label">已确认</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="stat-card">
              <div className="stat-number" style={{ color: '#faad14' }}>{summary.pending}</div>
              <div className="stat-label">待确认</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="stat-card">
              <Space direction="vertical" size={4}>
                <div>
                  <span style={{ color: '#ff4d4f', fontSize: 16, fontWeight: 'bold' }}>退款 ¥{summary.total_refund?.toFixed(2) || '0.00'}</span>
                </div>
                <div>
                  <span style={{ color: '#52c41a', fontSize: 14 }}>补款 ¥{summary.total_supplement?.toFixed(2) || '0.00'}</span>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      <Table
        columns={columns}
        dataSource={summary?.details || []}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1400 }}
      />
    </div>
  )
}

export default CompensationPage
