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
  Row,
  Col,
  Statistic,
  Alert,
  Modal,
  Progress,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { exportApi, materialApi } from '@/services/api'
import type { ExportRecord, MaterialFilterParams, ConsistencyCheckResult } from '@/types'

const { Option } = Select

function ExportPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ExportRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [minConfidence, setMinConfidence] = useState<number | undefined>()
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [consistencyResult, setConsistencyResult] = useState<ConsistencyCheckResult | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [screenCount, setScreenCount] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await exportApi.getRecords({ page, page_size: pageSize })
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
    loadScreenCount()
  }, [page, pageSize])

  const loadScreenCount = async () => {
    try {
      const filterParams = getFilterParams()
      const result = await materialApi.getSoundMaterials({
        ...filterParams,
        page_size: 1000,
      })
      setScreenCount(result.total)
    } catch (error) {
      console.error('获取屏幕数量失败')
    }
  }

  const getFilterParams = (): MaterialFilterParams => ({
    status: statusFilter,
    type: typeFilter,
    min_confidence: minConfidence,
  })

  const handlePreview = async () => {
    try {
      const filterParams = getFilterParams()
      const result = await exportApi.preview(filterParams)
      setPreviewCount(result.count)
      checkConsistency(result.count)
    } catch (error) {
      message.error('预览失败')
    }
  }

  const checkConsistency = async (exportCount: number) => {
    try {
      const filterParams = getFilterParams()
      const result = await exportApi.checkConsistency({
        ...filterParams,
        screen_count: screenCount,
      })
      setConsistencyResult(result)
    } catch (error) {
      message.error('一致性校验失败')
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      setExportProgress(20)
      const filterParams = getFilterParams()
      const filename = `环境音素材_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
      setExportProgress(50)
      const result = await exportApi.execute({
        ...filterParams,
        filename,
      })
      setExportProgress(80)
      message.success(`导出成功，共导出 ${result.total_count} 条记录`)
      setExportProgress(100)
      setTimeout(() => {
        setExporting(false)
        setExportProgress(0)
        fetchData()
      }, 1000)
    } catch (error) {
      message.error('导出失败')
      setExporting(false)
      setExportProgress(0)
    }
  }

  const handleDownload = async (id: number) => {
    try {
      const response = await exportApi.download(id)
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const record = data.find((r) => r.id === id)
      link.download = record?.filename || `export_${id}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      message.error('下载失败')
    }
  }

  const handleReset = () => {
    setStatusFilter(undefined)
    setTypeFilter(undefined)
    setMinConfidence(undefined)
    setPreviewCount(null)
    setConsistencyResult(null)
    loadScreenCount()
  }

  const columns: ColumnsType<ExportRecord> = [
    {
      title: '导出编号',
      dataIndex: 'export_no',
      key: 'export_no',
      width: 180,
      render: (text) => <code className="text-xs bg-gray-100 px-2 py-1 rounded">{text}</code>,
    },
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
    },
    {
      title: '导出数量',
      dataIndex: 'total_count',
      key: 'total_count',
      width: 100,
    },
    {
      title: '校验哈希',
      dataIndex: 'filter_hash',
      key: 'filter_hash',
      width: 120,
      render: (text) => <code className="text-xs">{text?.substring(0, 12)}...</code>,
    },
    {
      title: '导出人',
      dataIndex: 'exported_by',
      key: 'exported_by',
      width: 100,
    },
    {
      title: '导出时间',
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
          icon={<DownloadOutlined />}
          onClick={() => handleDownload(record.id)}
        >
          下载
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Card className="mb-4" title="导出筛选条件">
        <Space wrap className="mb-4">
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="confirmed">已确认</Option>
            <Option value="matched">已匹配</Option>
            <Option value="pending">待匹配</Option>
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
          <Select
            placeholder="最低置信度"
            value={minConfidence}
            onChange={setMinConfidence}
            style={{ width: 150 }}
            allowClear
          >
            <Option value={0.5}>50% 以上</Option>
            <Option value={0.7}>70% 以上</Option>
            <Option value={0.9}>90% 以上</Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handlePreview}>
            预览数量
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>

        <Row gutter={16} className="mb-4">
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="屏幕显示数量"
                value={screenCount}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="待导出数量"
                value={previewCount ?? '-'}
                valueStyle={{ color: previewCount !== null ? '#1890ff' : undefined }}
                prefix={<ExportOutlined />}
              />
            </Card>
          </Col>
          <Col span={12}>
            {consistencyResult && (
              <Alert
                message={consistencyResult.passed ? '数据一致性校验通过' : '数据不一致'}
                description={
                  consistencyResult.passed
                    ? `屏幕显示(${consistencyResult.screen_count})与导出数量(${consistencyResult.export_count})一致，哈希: ${consistencyResult.filter_hash}`
                    : consistencyResult.mismatch_details.join('; ')
                }
                type={consistencyResult.passed ? 'success' : 'warning'}
                showIcon
                icon={
                  consistencyResult.passed ? (
                    <CheckCircleOutlined />
                  ) : (
                    <ExclamationCircleOutlined />
                  )
                }
              />
            )}
          </Col>
        </Row>

        <Button
          type="primary"
          size="large"
          icon={<ExportOutlined />}
          onClick={handleExport}
          loading={exporting}
          disabled={previewCount === null || previewCount === 0}
        >
          执行导出
        </Button>

        {exporting && (
          <div className="mt-4">
            <Progress percent={exportProgress} status="active" />
          </div>
        )}
      </Card>

      <Card title="导出历史">
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
    </div>
  )
}

export default ExportPage
