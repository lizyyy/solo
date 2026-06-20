import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Space,
  Tag,
  Checkbox,
  Select,
  message,
  Card,
} from 'antd'
import {
  ArrowLeftOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { sliceApi, ReconciliationRecord, statusLabels, statusColors } from '../api'
import dayjs from 'dayjs'
import RecordDetail from './RecordDetail'

interface RecordListProps {
  sliceId: number
  onBack: () => void
}

function RecordList({ sliceId, onBack }: RecordListProps) {
  const [records, setRecords] = useState<ReconciliationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [minorityOnly, setMinorityOnly] = useState(false)
  const [maskedOnly, setMaskedOnly] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null)
  const [sliceInfo, setSliceInfo] = useState<any>(null)

  const loadRecords = async () => {
    setLoading(true)
    try {
      const res = await sliceApi.getRecords(sliceId, {
        status: statusFilter,
        minority_only: minorityOnly,
        masked_only: maskedOnly,
      })
      setRecords(res.data)
    } catch (error) {
      message.error('加载记录失败')
    } finally {
      setLoading(false)
    }
  }

  const loadSliceInfo = async () => {
    try {
      const res = await sliceApi.getSlice(sliceId)
      setSliceInfo(res.data)
    } catch (error) {
      // ignore
    }
  }

  useEffect(() => {
    loadSliceInfo()
    loadRecords()
  }, [sliceId, statusFilter, minorityOnly, maskedOnly])

  const handleViewDetail = (recordId: number) => {
    setSelectedRecordId(recordId)
    setDetailVisible(true)
  }

  const handleCloseDetail = () => {
    setDetailVisible(false)
    setSelectedRecordId(null)
    loadRecords()
  }

  const columns = [
    {
      title: '原始行号',
      dataIndex: 'original_row_number',
      key: 'original_row_number',
      width: 90,
      fixed: 'left' as const,
      render: (num: number, record: ReconciliationRecord) => (
        <Space>
          <span style={{ fontWeight: 600 }}>{num}</span>
          {record.is_masked_by_total && (
            <ExclamationCircleOutlined
              style={{ color: '#faad14' }}
              title="被总指标盖住"
            />
          )}
        </Space>
      ),
    },
    {
      title: '样本ID',
      dataIndex: 'sample_id',
      key: 'sample_id',
      width: 140,
    },
    {
      title: '样本类型',
      dataIndex: 'sample_type',
      key: 'sample_type',
      width: 100,
      render: (_type: string, record: ReconciliationRecord) => (
        record.is_minority ? (
          <Tag color="orange">少数类</Tag>
        ) : (
          <Tag>多数类</Tag>
        )
      ),
    },
    {
      title: '召回率',
      dataIndex: 'recall_rate',
      key: 'recall_rate',
      width: 100,
      render: (val: number | undefined) =>
        val !== undefined ? `${(val * 100).toFixed(1)}%` : '-',
    },
    {
      title: '准确率',
      dataIndex: 'precision_rate',
      key: 'precision_rate',
      width: 100,
      render: (val: number | undefined) =>
        val !== undefined ? `${(val * 100).toFixed(1)}%` : '-',
    },
    {
      title: '总指标',
      dataIndex: 'total_metric',
      key: 'total_metric',
      width: 100,
      render: (val: number | undefined, record: ReconciliationRecord) => (
        <span style={{ color: record.is_masked_by_total ? '#faad14' : undefined, fontWeight: record.is_masked_by_total ? 600 : undefined }}>
          {val !== undefined ? `${(val * 100).toFixed(1)}%` : '-'}
        </span>
      ),
    },
    {
      title: '被总指标盖住',
      dataIndex: 'is_masked_by_total',
      key: 'is_masked_by_total',
      width: 120,
      render: (val: boolean) =>
        val ? <Tag color="warning">是 ⚠️</Tag> : <Tag>否</Tag>,
    },
    {
      title: '特征快照编号',
      dataIndex: 'feature_snapshot_id',
      key: 'feature_snapshot_id',
      width: 140,
      render: (val: string | undefined) => val || '-',
    },
    {
      title: '阈值回放',
      key: 'threshold',
      width: 150,
      render: (_: any, record: ReconciliationRecord) => (
        <Space direction="vertical" size={0}>
          <span>阈值: {record.threshold_value ?? '-'}</span>
          <span style={{ fontSize: 12, color: '#666' }}>
            结果: {record.threshold_replay_result || '-'}
          </span>
        </Space>
      ),
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string) => (
        <Tag color={statusColors[status] as any}>
          {statusLabels[status] || status}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (t: string | undefined) =>
        t ? dayjs(t).format('MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: ReconciliationRecord) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.id)}
        >
          详情
        </Button>
      ),
    },
  ]

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'step1_imported', label: statusLabels.step1_imported },
    { value: 'step2_feature_added', label: statusLabels.step2_feature_added },
    { value: 'step3_threshold_updated', label: statusLabels.step3_threshold_updated },
    { value: 'pending_review', label: statusLabels.pending_review },
    { value: 'confirmed_normal', label: statusLabels.confirmed_normal },
    { value: 'confirmed_abnormal', label: statusLabels.confirmed_abnormal },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
          返回切片列表
        </Button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>
          {sliceInfo?.slice_name || `切片 #${sliceId}`} - 对账明细
        </span>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Checkbox
            checked={minorityOnly}
            onChange={(e) => setMinorityOnly(e.target.checked)}
          >
            只看少数类
          </Checkbox>
          <Checkbox
            checked={maskedOnly}
            onChange={(e) => setMaskedOnly(e.target.checked)}
          >
            只看被总指标盖住 ⚠️
          </Checkbox>
          <Select
            style={{ width: 180 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            placeholder="筛选状态"
            allowClear
          />
          <span style={{ color: '#666', marginLeft: 'auto' }}>
            共 <b>{records.length}</b> 条记录，
            待复核 <b style={{ color: '#faad14' }}>
              {records.filter(r => r.status === 'pending_review').length}
            </b> 条
          </span>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1400 }}
        size="small"
      />

      {detailVisible && selectedRecordId && (
        <RecordDetail
          recordId={selectedRecordId}
          visible={detailVisible}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  )
}

export default RecordList
