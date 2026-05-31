import { useState, useEffect } from 'react'
import {
  Table,
  Tag,
  Button,
  Space,
  Card,
  Input,
  Select,
  message,
  Modal,
  Row,
  Col,
  Statistic,
  Tooltip,
  Popconfirm,
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  SearchOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SoundOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { materialApi } from '@/services/api'
import type { MatchRelation } from '@/types'

const { Option } = Select
const { TextArea } = Input

function ReviewPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MatchRelation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [batchAction, setBatchAction] = useState<'confirm' | 'reject'>('confirm')
  const [batchRemark, setBatchRemark] = useState('')
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, rejected: 0 })

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await materialApi.getMatches({
        status: statusFilter,
        page,
        page_size: pageSize,
      })
      setData(result.items)
      setTotal(result.total)

      const allResult = await materialApi.getMatches({ page_size: 1000 })
      const pending = allResult.items.filter((i) => i.status === 'pending').length
      const confirmed = allResult.items.filter((i) => i.status === 'confirmed').length
      const rejected = allResult.items.filter((i) => i.status === 'rejected').length
      setStats({ total: allResult.total, pending, confirmed, rejected })
    } catch (error) {
      message.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [page, pageSize, statusFilter])

  const handleSearch = () => {
    setPage(1)
    fetchData()
  }

  const handleReset = () => {
    setSearchKeyword('')
    setStatusFilter('pending')
    setPage(1)
    fetchData()
  }

  const handleAutoMatch = async () => {
    try {
      await materialApi.autoMatch()
      message.success('自动匹配完成')
      fetchData()
    } catch (error) {
      message.error('自动匹配失败')
    }
  }

  const handleSingleConfirm = async (id: number) => {
    try {
      await materialApi.updateMatch(id, { status: 'confirmed' })
      message.success('确认成功')
      fetchData()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleSingleReject = async (id: number) => {
    try {
      await materialApi.updateMatch(id, { status: 'rejected' })
      message.success('驳回成功')
      fetchData()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleBatchAction = () => {
    setBatchModalVisible(true)
  }

  const executeBatchAction = async () => {
    try {
      if (batchAction === 'confirm') {
        await materialApi.batchConfirm(selectedRowKeys as number[], batchRemark)
      } else {
        await materialApi.batchReject(selectedRowKeys as number[], batchRemark)
      }
      message.success('批量操作成功')
      setBatchModalVisible(false)
      setSelectedRowKeys([])
      setBatchRemark('')
      fetchData()
    } catch (error) {
      message.error('批量操作失败')
    }
  }

  const getConfidenceClass = (confidence?: number) => {
    if (!confidence) return ''
    if (confidence >= 0.8) return 'confidence-high'
    if (confidence >= 0.5) return 'confidence-medium'
    return 'confidence-low'
  }

  const columns: ColumnsType<MatchRelation> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '素材ID',
      dataIndex: 'material_id',
      key: 'material_id',
      width: 80,
    },
    {
      title: '匹配类型',
      dataIndex: 'match_type',
      key: 'match_type',
      width: 100,
      render: (type) => (
        <Tag color={type === 'auto' ? 'blue' : 'green'}>
          {type === 'auto' ? '自动匹配' : '手动匹配'}
        </Tag>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (val) =>
        val ? (
          <span className={getConfidenceClass(val)}>
            {(val * 100).toFixed(0)}%
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colors: Record<string, string> = {
          pending: 'warning',
          confirmed: 'success',
          rejected: 'error',
        }
        const texts: Record<string, string> = {
          pending: '待复核',
          confirmed: '已确认',
          rejected: '已驳回',
        }
        return <Tag color={colors[status] || 'default'}>{texts[status] || status}</Tag>
      },
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) =>
        record.status === 'pending' ? (
          <Space>
            <Tooltip title="确认">
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleSingleConfirm(record.id)}
              >
                确认
              </Button>
            </Tooltip>
            <Tooltip title="驳回">
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleSingleReject(record.id)}
              >
                驳回
              </Button>
            </Tooltip>
          </Space>
        ) : null,
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: (record: MatchRelation) => ({
      disabled: record.status !== 'pending',
    }),
  }

  return (
    <div>
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic title="匹配总数" value={stats.total} prefix={<SoundOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待复核"
              value={stats.pending}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已确认"
              value={stats.confirmed}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已驳回"
              value={stats.rejected}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: 200 }}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
          >
            <Option value="pending">待复核</Option>
            <Option value="confirmed">已确认</Option>
            <Option value="rejected">已驳回</Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
          <Button icon={<ThunderboltOutlined />} onClick={handleAutoMatch}>
            自动匹配
          </Button>
          <Popconfirm
            title="确认批量操作"
            description={`已选择 ${selectedRowKeys.length} 条记录，确认执行？`}
            onConfirm={() => {
              setBatchAction('confirm')
              handleBatchAction()
            }}
            disabled={selectedRowKeys.length === 0}
          >
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={selectedRowKeys.length === 0}
            >
              批量确认
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确认批量驳回"
            description={`已选择 ${selectedRowKeys.length} 条记录，确认驳回？`}
            onConfirm={() => {
              setBatchAction('reject')
              handleBatchAction()
            }}
            disabled={selectedRowKeys.length === 0}
          >
            <Button
              danger
              icon={<CloseCircleOutlined />}
              disabled={selectedRowKeys.length === 0}
            >
              批量驳回
            </Button>
          </Popconfirm>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      <Modal
        title={batchAction === 'confirm' ? '批量确认' : '批量驳回'}
        open={batchModalVisible}
        onOk={executeBatchAction}
        onCancel={() => setBatchModalVisible(false)}
        okText="确认"
        cancelText="取消"
      >
        <p className="mb-4">
          已选择 <strong>{selectedRowKeys.length}</strong> 条记录
        </p>
        <TextArea
          rows={4}
          placeholder="请输入备注（可选）"
          value={batchRemark}
          onChange={(e) => setBatchRemark(e.target.value)}
        />
      </Modal>
    </div>
  )
}

export default ReviewPage
