import { useState, useEffect } from 'react'
import {
  Table,
  Tag,
  Input,
  Select,
  Button,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  Modal,
  Timeline,
  message,
  Tooltip,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  ArrowRightOutlined,
  SoundOutlined,
  FileTextOutlined,
  AudioOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { materialApi } from '@/services/api'
import type { SoundMaterial, TraceChain } from '@/types'

const { Option } = Select

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待匹配', color: 'warning' },
  matched: { text: '已匹配', color: 'processing' },
  confirmed: { text: '已确认', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
}

const typeMap: Record<string, string> = {
  '自然音': '自然音',
  '环境音': '环境音',
  '背景音乐': '背景音乐',
  '转场音': '转场音',
}

function MaterialsPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SoundMaterial[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [traceModalVisible, setTraceModalVisible] = useState(false)
  const [traceData, setTraceData] = useState<TraceChain | null>(null)
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0, matched: 0 })

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await materialApi.getSoundMaterials({
        search_keyword: searchKeyword || undefined,
        status: statusFilter,
        type: typeFilter,
        page,
        page_size: pageSize,
      })
      setData(result.items)
      setTotal(result.total)
      
      const allResult = await materialApi.getSoundMaterials({ page_size: 1000 })
      const confirmed = allResult.items.filter((i) => i.status === 'confirmed').length
      const pending = allResult.items.filter((i) => i.status === 'pending').length
      const matched = allResult.items.filter((i) => i.status === 'matched').length
      setStats({ total: allResult.total, confirmed, pending, matched })
    } catch (error) {
      message.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [page, pageSize])

  const handleSearch = () => {
    setPage(1)
    fetchData()
  }

  const handleReset = () => {
    setSearchKeyword('')
    setStatusFilter(undefined)
    setTypeFilter(undefined)
    setPage(1)
    fetchData()
  }

  const showTrace = async (id: number) => {
    try {
      const result = await materialApi.getMaterialTrace(id)
      setTraceData(result)
      setTraceModalVisible(true)
    } catch (error) {
      message.error('获取溯源信息失败')
    }
  }

  const getConfidenceClass = (confidence?: number) => {
    if (!confidence) return ''
    if (confidence >= 0.8) return 'confidence-high'
    if (confidence >= 0.5) return 'confidence-medium'
    return 'confidence-low'
  }

  const getTraceIcon = (type: string) => {
    switch (type) {
      case 'material':
        return <SoundOutlined />
      case 'match':
        return <FileTextOutlined />
      case 'ad_script':
        return <FileTextOutlined />
      case 'audio_track':
        return <AudioOutlined />
      default:
        return <FileTextOutlined />
    }
  }

  const getTraceColor = (type: string) => {
    switch (type) {
      case 'material':
        return 'blue'
      case 'match':
        return 'green'
      case 'ad_script':
        return 'orange'
      case 'audio_track':
        return 'purple'
      default:
        return 'gray'
    }
  }

  const columns: ColumnsType<SoundMaterial> = [
    {
      title: '素材编号',
      dataIndex: 'material_no',
      key: 'material_no',
      width: 180,
      render: (text) => <code className="text-xs bg-gray-100 px-2 py-1 rounded">{text}</code>,
    },
    {
      title: '素材名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (text) => typeMap[text] || text,
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (val) => `${val}s`,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space wrap>
          {tags?.map((tag) => (
            <Tag key={tag} color="blue" className="mb-1">
              {tag}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '匹配置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 120,
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
        const info = statusMap[status] || { text: status, color: 'default' }
        return <Tag color={info.color}>{info.text}</Tag>
      },
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
      render: (_, record) => (
        <Space>
          <Tooltip title="查看溯源">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => showTrace(record.id)}
            >
              溯源
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic title="素材总数" value={stats.total} prefix={<SoundOutlined />} />
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
              title="待匹配"
              value={stats.pending}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已匹配待确认"
              value={stats.matched}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索素材名称、标签"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: 250 }}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="pending">待匹配</Option>
            <Option value="matched">已匹配</Option>
            <Option value="confirmed">已确认</Option>
            <Option value="rejected">已驳回</Option>
          </Select>
          <Select
            placeholder="类型筛选"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="自然音">自然音</Option>
            <Option value="环境音">环境音</Option>
            <Option value="背景音乐">背景音乐</Option>
            <Option value="转场音">转场音</Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
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
        title="溯源链路"
        open={traceModalVisible}
        onCancel={() => setTraceModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setTraceModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {traceData && (
          <Timeline mode="left">
            {traceData.links.map((link, index) => (
              <Timeline.Item
                key={link.id}
                color={getTraceColor(link.type)}
                dot={getTraceIcon(link.type)}
              >
                <div className="font-medium">{link.name}</div>
                <div className="text-sm text-gray-500">
                  {link.no} · {dayjs(link.timestamp).format('YYYY-MM-DD HH:mm')}
                </div>
                <div className="text-xs text-gray-400">操作人: {link.operator}</div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Modal>
    </div>
  )
}

export default MaterialsPage
