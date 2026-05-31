import { useState, useEffect } from 'react'
import {
  Table,
  Tag,
  Card,
  Input,
  Select,
  Button,
  Space,
  message,
  Modal,
  Descriptions,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { historyApi } from '@/services/api'
import type { OperationHistory } from '@/types'

const { Option } = Select

function HistoryPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OperationHistory[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [operationType, setOperationType] = useState<string | undefined>()
  const [targetType, setTargetType] = useState<string | undefined>()
  const [operator, setOperator] = useState<string | undefined>()
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [detailData, setDetailData] = useState<OperationHistory | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await historyApi.getHistory({
        operation_type: operationType,
        target_type: targetType,
        operator: operator || undefined,
        page,
        page_size: pageSize,
      })
      setData(result.items)
      setTotal(result.total)
    } catch (error) {
      message.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [page, pageSize, operationType, targetType, operator])

  const handleSearch = () => {
    setPage(1)
    fetchData()
  }

  const handleReset = () => {
    setOperationType(undefined)
    setTargetType(undefined)
    setOperator(undefined)
    setPage(1)
    fetchData()
  }

  const showDetail = async (id: number) => {
    try {
      const result = await historyApi.getHistoryDetail(id)
      setDetailData(result)
      setDetailModalVisible(true)
    } catch (error) {
      message.error('获取详情失败')
    }
  }

  const getOperationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      create: 'blue',
      update: 'orange',
      delete: 'red',
      import: 'green',
      export: 'purple',
      confirm: 'cyan',
      reject: 'magenta',
      auto_match: 'gold',
    }
    return colors[type] || 'default'
  }

  const getOperationTypeName = (type: string) => {
    const names: Record<string, string> = {
      create: '创建',
      update: '更新',
      delete: '删除',
      import: '导入',
      export: '导出',
      confirm: '确认',
      reject: '驳回',
      auto_match: '自动匹配',
    }
    return names[type] || type
  }

  const getTargetTypeName = (type: string) => {
    const names: Record<string, string> = {
      sound_material: '环境音素材',
      match_relation: '匹配关系',
      audio_track: '原始音轨',
      ad_script: '广告口播',
      export_record: '导出记录',
      import_batch: '导入批次',
    }
    return names[type] || type
  }

  const columns: ColumnsType<OperationHistory> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '操作类型',
      dataIndex: 'operation_type',
      key: 'operation_type',
      width: 120,
      render: (type) => (
        <Tag color={getOperationTypeColor(type)}>{getOperationTypeName(type)}</Tag>
      ),
    },
    {
      title: '目标类型',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 120,
      render: (type) => getTargetTypeName(type),
    },
    {
      title: '目标ID',
      dataIndex: 'target_id',
      key: 'target_id',
      width: 100,
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 120,
    },
    {
      title: '溯源ID',
      dataIndex: 'trace_id',
      key: 'trace_id',
      width: 180,
      render: (text) =>
        text ? (
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{text}</code>
        ) : (
          '-'
        ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => showDetail(record.id)}
        >
          详情
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Card className="mb-4">
        <Space wrap>
          <Select
            placeholder="操作类型"
            value={operationType}
            onChange={setOperationType}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="create">创建</Option>
            <Option value="update">更新</Option>
            <Option value="delete">删除</Option>
            <Option value="import">导入</Option>
            <Option value="export">导出</Option>
            <Option value="confirm">确认</Option>
            <Option value="reject">驳回</Option>
            <Option value="auto_match">自动匹配</Option>
          </Select>
          <Select
            placeholder="目标类型"
            value={targetType}
            onChange={setTargetType}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="sound_material">环境音素材</Option>
            <Option value="match_relation">匹配关系</Option>
            <Option value="audio_track">原始音轨</Option>
            <Option value="ad_script">广告口播</Option>
          </Select>
          <Input
            placeholder="操作人"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            style={{ width: 150 }}
          />
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
        title="操作详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {detailData && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="操作ID">{detailData.id}</Descriptions.Item>
            <Descriptions.Item label="操作类型">
              <Tag color={getOperationTypeColor(detailData.operation_type)}>
                {getOperationTypeName(detailData.operation_type)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="目标类型">
              {getTargetTypeName(detailData.target_type)}
            </Descriptions.Item>
            <Descriptions.Item label="目标ID">{detailData.target_id}</Descriptions.Item>
            <Descriptions.Item label="操作人">{detailData.operator}</Descriptions.Item>
            <Descriptions.Item label="操作时间">
              {dayjs(detailData.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="溯源ID" span={2}>
              {detailData.trace_id ? (
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {detailData.trace_id}
                </code>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="变更前数据" span={2}>
              <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-40">
                {detailData.before_data || '-'}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="变更后数据" span={2}>
              <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-40">
                {detailData.after_data || '-'}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>
              {detailData.remark || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default HistoryPage
