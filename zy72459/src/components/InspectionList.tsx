import { useState } from 'react'
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Steps,
  message,
  Popconfirm,
  Typography
} from 'antd'
import {
  ImportOutlined,
  FileTextOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useInspection, useUnifiedDataSource } from '@/store/InspectionContext'
import { InspectionRecord } from '@/types'
import { getStatusText, getStatusColor, getConflictTypeText } from '@/utils/helpers'
import { mockSamplingPoints, mockComplaints, duplicateSamplingPoint } from '@/data/mockData'
import { exportToExcel } from '@/services/exportService'
import RecordDetail from './RecordDetail'
import RampSupplementModal from './RampSupplementModal'
import SuggestionEditModal from './SuggestionEditModal'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Step } = Steps

export default function InspectionList() {
  const { state, dispatch } = useInspection()
  const { getRecordsForDisplay, getRecordsForExport, getRecordsForApi } = useUnifiedDataSource()
  const [selectedRecord, setSelectedRecord] = useState<InspectionRecord | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [rampModalVisible, setRampModalVisible] = useState(false)
  const [suggestionVisible, setSuggestionVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [importModalVisible, setImportModalVisible] = useState(false)

  const records = getRecordsForDisplay()

  const handleImportSampling = () => {
    dispatch({ type: 'IMPORT_SAMPLING_POINTS', payload: mockSamplingPoints })
    setCurrentStep(1)
    message.success('夜间采样点导入成功')
    setImportModalVisible(false)
  }

  const handleImportComplaints = () => {
    dispatch({ type: 'ADD_COMPLAINTS', payload: mockComplaints })
    setCurrentStep(2)
    message.success('居民投诉编号关联成功')
  }

  const handleTestDuplicate = () => {
    dispatch({ type: 'IMPORT_SAMPLING_POINTS', payload: [duplicateSamplingPoint] })
    message.warning('检测到重复导入，已标记')
  }

  const handleRampSupplement = (record: InspectionRecord) => {
    setSelectedRecord(record)
    setRampModalVisible(true)
  }

  const handleEditSuggestion = (record: InspectionRecord) => {
    setSelectedRecord(record)
    setSuggestionVisible(true)
  }

  const handleViewDetail = (record: InspectionRecord) => {
    setSelectedRecord(record)
    setDetailVisible(true)
  }

  const handleExport = () => {
    const exportData = getRecordsForExport()
    const apiData = getRecordsForApi()
    const displayData = getRecordsForDisplay()
    
    console.log('统一数据源验证:', {
      display: displayData.length,
      export: exportData.records.length,
      api: apiData.length,
      checksum: exportData.checksum
    })
    
    exportToExcel(exportData.records, state.currentOperator)
    message.success('导出成功，数据与页面展示一致')
  }

  const columns: ColumnsType<InspectionRecord> = [
    {
      title: '点位编号',
      dataIndex: 'pointCode',
      key: 'pointCode',
      width: 100,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      ellipsis: true
    },
    {
      title: '评分',
      key: 'score',
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 16, color: record.score < 30 ? '#ff4d4f' : record.score < 60 ? '#faad14' : '#52c41a' }}>
            {record.score}分
          </Text>
          {record.rampSupplementTime && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              原始: {record.originalScore}分
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Tag color={getStatusColor(record.status)}>
          {getStatusText(record.status)}
        </Tag>
      )
    },
    {
      title: '坡道补录',
      key: 'ramp',
      width: 100,
      render: (_, record) => (
        record.rampSupplementTime ? (
          <Space direction="vertical" size={0}>
            <Tag color={record.rampScoreUnchanged ? 'red' : 'green'}>
              {record.rampScoreUnchanged ? '评分未变' : '已补录'}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(record.rampSupplementTime).format('MM-DD HH:mm')}
            </Text>
          </Space>
        ) : (
          <Tag>未补录</Tag>
        )
      )
    },
    {
      title: '关联投诉',
      key: 'complaints',
      width: 100,
      render: (_, record) => (
        <Tag color={record.complaints.length > 0 ? 'blue' : 'default'}>
          {record.complaints.length} 条
        </Tag>
      )
    },
    {
      title: '待处理冲突',
      key: 'conflicts',
      width: 120,
      render: (_, record) => {
        const unresolved = record.conflictEvidence.filter(c => !c.resolved)
        return unresolved.length > 0 ? (
          <Tag color="red" icon={<ExclamationCircleOutlined />}>
            {unresolved.length} 个
          </Tag>
        ) : (
          <Tag color="green">无</Tag>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {!record.rampSupplementTime && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleRampSupplement(record)}
            >
              坡道补录
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleEditSuggestion(record)}
          >
            整改建议
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="page-title">街角照明暗区排查</div>

      <div className="card-section">
        <div className="section-title">
          <Steps current={currentStep} size="small" className="step-indicator" style={{ flex: 1 }}>
            <Step title="夜间采样点导入" />
            <Step title="居民投诉编号关联" />
            <Step title="整改建议更新" />
          </Steps>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<ImportOutlined />}
            onClick={() => setImportModalVisible(true)}
            disabled={currentStep >= 1}
          >
            导入夜间采样点
          </Button>
          <Button
            icon={<FileTextOutlined />}
            onClick={handleImportComplaints}
            disabled={currentStep < 1 || currentStep >= 2}
          >
            关联居民投诉
          </Button>
          <Popconfirm
            title="确定要测试重复导入吗？"
            description="系统将导入一条与ZM-001重复的采样点数据"
            onConfirm={handleTestDuplicate}
            okText="确定"
            cancelText="取消"
          >
            <Button danger>测试重复导入</Button>
          </Popconfirm>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={records.length === 0}
          >
            导出明细
          </Button>
        </Space>
      </div>

      <div className="card-section">
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (record) => (
              <div>
                {record.conflictEvidence.length > 0 && (
                  <div>
                    <Text strong>冲突证据：</Text>
                    <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
                      {record.conflictEvidence.map(conflict => (
                        <div
                          key={conflict.id}
                          className={`conflict-card ${conflict.resolved ? 'resolved' : ''} ${conflict.type === 'ramp_score_unchanged' ? 'ramp-issue' : ''}`}
                        >
                          <Space>
                            <Tag color={conflict.resolved ? 'green' : 'orange'}>
                              {conflict.resolved ? '已处理' : '待处理'}
                            </Tag>
                            <Text strong>{getConflictTypeText(conflict.type)}</Text>
                          </Space>
                          <div style={{ marginTop: 4 }}>{conflict.description}</div>
                          {conflict.resolved && conflict.resolution && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              处理结果：{conflict.resolution === 'confirmed' ? '确认' : '驳回'}，处理人：{conflict.resolvedBy}
                            </Text>
                          )}
                        </div>
                      ))}
                    </Space>
                  </div>
                )}
              </div>
            )
          }}
        />
      </div>

      <Modal
        title="导入夜间采样点"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setImportModalVisible(false)}>取消</Button>,
          <Button key="confirm" type="primary" onClick={handleImportSampling}>
            确认导入
          </Button>
        ]}
      >
        <p>将导入 5 条夜间采样点数据，包含不同的照明情况和坡道信息。</p>
        <p>导入后系统将自动创建排查记录。</p>
      </Modal>

      {selectedRecord && (
        <>
          <RecordDetail
            visible={detailVisible}
            record={selectedRecord}
            onClose={() => setDetailVisible(false)}
          />
          <RampSupplementModal
            visible={rampModalVisible}
            record={selectedRecord}
            onClose={() => setRampModalVisible(false)}
          />
          <SuggestionEditModal
            visible={suggestionVisible}
            record={selectedRecord}
            onClose={() => setSuggestionVisible(false)}
          />
        </>
      )}
    </div>
  )
}
