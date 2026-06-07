import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Table,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Input,
  message,
  Drawer,
  Descriptions,
  Timeline,
  Badge,
  Tooltip,
  Popconfirm
} from 'antd'
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  EditOutlined,
  MessageOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  RollbackOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { batchApi, sampleApi } from '../api'
import {
  SAMPLE_STATUS_LABEL,
  SAMPLE_STATUS_COLOR,
  SAMPLE_STATUS,
  OPERATION_TYPE_LABEL,
  ROLE_LABEL
} from '../utils/constants'

const BatchDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [commentModalVisible, setCommentModalVisible] = useState(false)
  const [selectedSample, setSelectedSample] = useState(null)
  const [commentForm] = Form.useForm()
  const [logDrawerVisible, setLogDrawerVisible] = useState(false)
  const [sampleLogs, setSampleLogs] = useState([])
  const [filterStatus, setFilterStatus] = useState('all')

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const data = await batchApi.getDetail(id)
      setDetail(data)
    } catch (e) {
      message.error('获取批次详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
  }, [id])

  const filteredSamples = useMemo(() => {
    if (!detail?.samples) return []
    if (filterStatus === 'all') return detail.samples
    return detail.samples.filter(s => s.status === filterStatus)
  }, [detail, filterStatus])

  const handleAddComment = async (values) => {
    try {
      await sampleApi.addComment(selectedSample.id, {
        comment: values.comment,
        operator: '周姐'
      })
      message.success('留言添加成功')
      setCommentModalVisible(false)
      commentForm.resetFields()
      setSelectedSample(null)
      fetchDetail()
    } catch (e) {
      message.error(e || '添加失败')
    }
  }

  const handleReviewConfirm = async (sampleId) => {
    try {
      await sampleApi.reviewConfirm(sampleId, { operator: '运营复核人' })
      message.success('复核通过')
      fetchDetail()
    } catch (e) {
      message.error(e || '操作失败')
    }
  }

  const handleReviewReject = async (sampleId) => {
    try {
      await sampleApi.reviewReject(sampleId, { operator: '运营复核人', reason: '需要重新标注' })
      message.success('已驳回')
      fetchDetail()
    } catch (e) {
      message.error(e || '操作失败')
    }
  }

  const handleRollback = async (sampleId) => {
    try {
      await sampleApi.rollback(sampleId, { operator: '运营复核人', reason: '操作错误' })
      message.success('已回滚')
      fetchDetail()
    } catch (e) {
      message.error(e || '操作失败')
    }
  }

  const showSampleLogs = async (sample) => {
    setSelectedSample(sample)
    try {
      const logs = await sampleApi.getLogs(sample.id)
      setSampleLogs(logs)
      setLogDrawerVisible(true)
    } catch (e) {
      message.error('获取操作日志失败')
    }
  }

  const columns = [
    {
      title: '原始行号',
      dataIndex: 'originalRowNumber',
      key: 'originalRowNumber',
      width: 90,
      fixed: 'left',
      render: (val) => <Tag>{val}</Tag>
    },
    {
      title: '样本编号',
      dataIndex: 'sampleId',
      key: 'sampleId',
      width: 150,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{text}</span>
          {record.matchedRules?.some(r => r.code === 'MODEL_VERSION_CHANGED_SAME_ID') && (
            <Tag color="gold" style={{ fontSize: 11 }}>
              模型版本变更
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '模型版本',
      dataIndex: 'modelVersion',
      key: 'modelVersion',
      width: 120
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      width: 200,
      ellipsis: true
    },
    {
      title: '排班建议',
      dataIndex: 'schedulingSuggestion',
      key: 'schedulingSuggestion',
      width: 200,
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status) => (
        <Tag color={SAMPLE_STATUS_COLOR[status]}>
          {SAMPLE_STATUS_LABEL[status]}
        </Tag>
      )
    },
    {
      title: '解释说明',
      key: 'explanation',
      width: 280,
      render: (_, record) => (
        <Tooltip title={record.explanation}>
          <div style={{ 
            maxWidth: 280, 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: '#666',
            fontSize: 12
          }}>
            {record.explanation || '-'}
          </div>
        </Tooltip>
      )
    },
    {
      title: '标注员留言',
      dataIndex: 'annotatorComment',
      key: 'annotatorComment',
      width: 150,
      ellipsis: true,
      render: (val) => val ? (
        <Space>
          <MessageOutlined style={{ color: '#1677ff' }} />
          <span>{val}</span>
        </Space>
      ) : '-'
    },
    {
      title: '人工改动',
      key: 'manualChanges',
      width: 100,
      render: (_, record) => {
        const hasChanges = record.manualChanges && Object.keys(record.manualChanges).length > 0
        return hasChanges ? <Badge status="processing" text="有改动" /> : '-'
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<MessageOutlined />}
            onClick={() => {
              setSelectedSample(record)
              setCommentModalVisible(true)
            }}
          >
            补留言
          </Button>
          {record.status === SAMPLE_STATUS.MODEL_VERSION_CHANGED && (
            <>
              <Popconfirm
                title="确认复核通过？"
                description="确认该样本的模型版本变更为正常迭代"
                onConfirm={() => handleReviewConfirm(record.id)}
              >
                <Button type="link" size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }}>
                  通过
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认驳回？"
                description="该样本需要重新处理"
                onConfirm={() => handleReviewReject(record.id)}
              >
                <Button type="link" size="small" icon={<CloseCircleOutlined />} style={{ color: '#ff4d4f' }}>
                  驳回
                </Button>
              </Popconfirm>
            </>
          )}
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => showSampleLogs(record)}
          >
            日志
          </Button>
          {record.status !== SAMPLE_STATUS.ROLLED_BACK && (
            <Popconfirm
              title="确认回滚？"
              description="将该样本状态回滚为已回滚"
              onConfirm={() => handleRollback(record.id)}
            >
              <Button type="link" size="small" icon={<RollbackOutlined />} danger>
                回滚
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  if (!detail) {
    return <div className="page-container">加载中...</div>
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            返回列表
          </Button>
        </Space>
        <h1>{detail.batch.name}</h1>
        <p className="description">
          模型版本：{detail.batch.modelVersion} | 
          导入人：{detail.batch.importedBy} | 
          导入时间：{dayjs(detail.batch.createdAt).format('YYYY-MM-DD HH:mm:ss')}
        </p>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic title="样本总数" value={detail.stats.total} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="正常" value={detail.stats.normal} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="模型版本变更待复核" 
              value={detail.stats.modelVersionChanged} 
              valueStyle={{ color: '#faad14' }} 
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="异常" value={detail.stats.abnormal} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="复核通过" value={detail.stats.reviewConfirmed} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="复核驳回" value={detail.stats.reviewRejected} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      {detail.stats.modelVersionChanged > 0 && (
        <div className="card-section" style={{ borderLeft: '4px solid #faad14' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: '#d46b08' }}>
                ⚠️ 注意：本批次有 {detail.stats.modelVersionChanged} 条记录检测到「模型版本换了但样本编号没变」
              </h3>
              <p style={{ margin: '8px 0 0 0', color: '#874d00', fontSize: 13 }}>
                这些记录已自动标记为「模型版本变更待复核」，请运营复核人逐一确认是否为正常模型迭代。
                不要急于归为正常，务必核对前后模型版本的差异。
              </p>
            </div>
            <Button 
              type="primary" 
              onClick={() => setFilterStatus(SAMPLE_STATUS.MODEL_VERSION_CHANGED)}
            >
              筛选待复核记录
            </Button>
          </div>
        </div>
      )}

      <div className="card-section">
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <h2 style={{ border: 'none', padding: 0, margin: 0 }}>样本明细</h2>
            <Space size="small">
              <Button 
                size="small" 
                type={filterStatus === 'all' ? 'primary' : 'default'}
                onClick={() => setFilterStatus('all')}
              >
                全部
              </Button>
              <Button 
                size="small" 
                type={filterStatus === SAMPLE_STATUS.MODEL_VERSION_CHANGED ? 'primary' : 'default'}
                onClick={() => setFilterStatus(SAMPLE_STATUS.MODEL_VERSION_CHANGED)}
              >
                模型变更待复核
              </Button>
              <Button 
                size="small" 
                type={filterStatus === SAMPLE_STATUS.ABNORMAL ? 'primary' : 'default'}
                onClick={() => setFilterStatus(SAMPLE_STATUS.ABNORMAL)}
              >
                异常
              </Button>
            </Space>
          </Space>
          <Button icon={<DownloadOutlined />} onClick={() => batchApi.export(id)}>
            导出明细
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={filteredSamples}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1600, y: 500 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </div>

      <Modal
        title="标注负责人补充留言"
        open={commentModalVisible}
        onCancel={() => {
          setCommentModalVisible(false)
          commentForm.resetFields()
          setSelectedSample(null)
        }}
        footer={null}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="样本编号">
              {selectedSample?.sampleId}
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={SAMPLE_STATUS_COLOR[selectedSample?.status]}>
                {SAMPLE_STATUS_LABEL[selectedSample?.status]}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </div>
        <Form
          form={commentForm}
          layout="vertical"
          onFinish={handleAddComment}
        >
          <Form.Item
            name="comment"
            label="补充留言（给运营复核人看）"
            rules={[{ required: true, message: '请输入留言内容' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入需要补充说明的内容，如标注细节、特殊情况等..." />
          </Form.Item>
          <div className="explanation-box">
            <div className="title">💡 写给周姐</div>
            <div className="content">
              这里的留言会和样本一起展示给运营复核人。碰到模型版本换了但样本编号没变的情况，
              记得把你了解的背景写上，比如是不是模型迭代了、有没有换标注规则等。
            </div>
          </div>
          <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCommentModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="操作日志"
        placement="right"
        width={500}
        open={logDrawerVisible}
        onClose={() => {
          setLogDrawerVisible(false)
          setSampleLogs([])
          setSelectedSample(null)
        }}
      >
        <Descriptions size="small" column={1} bordered style={{ marginBottom: 24 }}>
          <Descriptions.Item label="样本编号">
            {selectedSample?.sampleId}
          </Descriptions.Item>
          <Descriptions.Item label="原始行号">
            第 {selectedSample?.originalRowNumber} 行
          </Descriptions.Item>
        </Descriptions>

        <Timeline
          items={sampleLogs.map(log => ({
            color: log.type === 'batch_import' ? 'blue' : 
                   log.type === 'review_confirm' ? 'green' :
                   log.type === 'review_reject' ? 'red' :
                   log.type === 'rollback' ? 'default' : 'gray',
            children: (
              <div>
                <div style={{ fontWeight: 500 }}>
                  {OPERATION_TYPE_LABEL[log.type]}
                </div>
                <div style={{ color: '#666', fontSize: 12, margin: '4px 0' }}>
                  操作人：{log.operator}（{ROLE_LABEL[log.operatorRole]}）
                </div>
                <div style={{ fontSize: 13 }}>{log.detail}</div>
                <div style={{ color: '#999', fontSize: 11, marginTop: 4 }}>
                  {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </div>
              </div>
            )
          }))}
        />
      </Drawer>
    </div>
  )
}

export default BatchDetail
