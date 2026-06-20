import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Collapse,
  Tooltip,
  message,
  Popconfirm,
  Modal,
  Form,
  Badge,
  Input
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  ArrowRightOutlined,
  QuestionCircleOutlined,
  FileTextOutlined,
  HistoryOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { dashboardApi, sampleApi } from '../api'
import {
  SAMPLE_STATUS_LABEL,
  SAMPLE_STATUS_COLOR,
  SAMPLE_STATUS,
  OPERATION_TYPE_LABEL,
  ROLE_LABEL
} from '../utils/constants'

const { Panel } = Collapse

const ReviewDashboard = () => {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [boundaryRules, setBoundaryRules] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedSample, setSelectedSample] = useState(null)
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [rejectForm] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [reviewData, rules] = await Promise.all([
        dashboardApi.getReviewData(),
        dashboardApi.getBoundaryRules()
      ])
      setData(reviewData)
      setBoundaryRules(rules)
    } catch (e) {
      message.error('获取复盘数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleReviewConfirm = async (sampleId) => {
    try {
      await sampleApi.reviewConfirm(sampleId, { operator: '运营复核人' })
      message.success('复核通过，已标记为正常')
      fetchData()
    } catch (e) {
      message.error(e || '操作失败')
    }
  }

  const handleReviewReject = async (values) => {
    try {
      await sampleApi.reviewReject(selectedSample.id, {
        operator: '运营复核人',
        reason: values.reason
      })
      message.success('已驳回，已通知标注团队')
      setRejectModalVisible(false)
      rejectForm.resetFields()
      setSelectedSample(null)
      fetchData()
    } catch (e) {
      message.error(e || '操作失败')
    }
  }

  const modelChangeColumns = [
    {
      title: '样本编号',
      dataIndex: 'sampleId',
      key: 'sampleId',
      width: 130,
      fixed: 'left',
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>
    },
    {
      title: '所属批次',
      dataIndex: 'batchName',
      key: 'batchName',
      width: 180
    },
    {
      title: '当前模型版本',
      dataIndex: 'modelVersion',
      key: 'modelVersion',
      width: 130,
      render: (val) => <Tag color="blue">{val}</Tag>
    },
    {
      title: '前次模型版本',
      dataIndex: 'previousModelVersion',
      key: 'previousModelVersion',
      width: 130,
      render: (val) => val ? <Tag color="default">{val}</Tag> : '-'
    },
    {
      title: '前次批次',
      key: 'previousBatch',
      width: 200,
      render: (_, record) => record.previousBatchName ? (
        <Space direction="vertical" size={0}>
          <span>{record.previousBatchName}</span>
          <span style={{ color: '#999', fontSize: 11 }}>
            {dayjs(record.previousBatchDate).format('YYYY-MM-DD')}
          </span>
        </Space>
      ) : '-'
    },
    {
      title: '解释说明',
      dataIndex: 'explanation',
      key: 'explanation',
      width: 300,
      render: (val) => (
        <div className="explanation-box" style={{ margin: 0 }}>
          <div className="content" style={{ fontSize: 12 }}>{val}</div>
        </div>
      )
    },
    {
      title: '标注员留言',
      dataIndex: 'annotatorComment',
      key: 'annotatorComment',
      width: 150,
      ellipsis: true,
      render: (val) => val || '-'
    },
    {
      title: '留言数',
      dataIndex: 'commentCount',
      key: 'commentCount',
      width: 80,
      render: (val) => val > 0 ? <Badge count={val} /> : 0
    },
    {
      title: '下一步动作',
      dataIndex: 'nextAction',
      key: 'nextAction',
      width: 200,
      render: (val) => (
        <div className="next-action-box" style={{ margin: 0 }}>
          <div className="content" style={{ fontSize: 12 }}>{val}</div>
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/batch/${record.batchId}`)}
          >
            查看详情
          </Button>
          <Popconfirm
            title="确认复核通过？"
            description={
              <div>
                <p>确认该样本的模型版本变更为正常迭代？</p>
                <p style={{ color: '#666', fontSize: 12 }}>
                  前次版本：{record.previousModelVersion} → 本次版本：{record.modelVersion}
                </p>
              </div>
            }
            onConfirm={() => handleReviewConfirm(record.id)}
          >
            <Button type="primary" size="small" icon={<CheckCircleOutlined />}>
              复核通过
            </Button>
          </Popconfirm>
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => {
              setSelectedSample(record)
              setRejectModalVisible(true)
            }}
          >
            驳回
          </Button>
        </Space>
      )
    }
  ]

  const recentColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (val) => <Tag>{OPERATION_TYPE_LABEL[val]}</Tag>
    },
    {
      title: '批次',
      dataIndex: 'batchName',
      key: 'batchName',
      width: 150
    },
    {
      title: '操作人',
      key: 'operator',
      width: 150,
      render: (_, record) => (
        <Space>
          <span>{record.operator}</span>
          <Tag color="default" style={{ fontSize: 11 }}>
            {ROLE_LABEL[record.operatorRole]}
          </Tag>
        </Space>
      )
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail'
    }
  ]

  if (!data) {
    return <div className="page-container">加载中...</div>
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>产品复盘页</h1>
        <p className="description">
          运营复核人专用页面。在这里可以看到所有需要复核的记录，特别是「模型版本换了但样本编号没变」的情况。
        </p>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总批次数" value={data.stats.totalBatches} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总样本数" value={data.stats.totalSamples} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="待复核总数" 
              value={data.stats.pendingReview} 
              valueStyle={{ color: '#faad14' }} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="模型版本变更待复核" 
              value={data.stats.modelVersionChangedCount} 
              valueStyle={{ color: '#faad14' }} 
              prefix={<QuestionCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <div className="card-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ border: 'none', padding: 0, margin: 0 }}>
            🎯 模型版本换了但样本编号没变 - 待复核列表
          </h2>
          <Tag color="gold" style={{ fontSize: 14, padding: '4px 12px' }}>
            共 {data.modelVersionChangedSamples.length} 条待处理
          </Tag>
        </div>

        <div className="explanation-box" style={{ marginBottom: 16 }}>
          <div className="title">📋 复核说明（给运营复核人）</div>
          <div className="content">
            1. 这里的每条记录都是：<strong>样本编号之前出现过，但这次用的模型版本不一样</strong><br />
            2. 先看「解释说明」了解具体情况，再看「标注员留言」有没有补充信息<br />
            3. 如果是正常的模型迭代（比如模型升级了，用旧样本验证效果）→ 点「复核通过」<br />
            4. 如果是数据错误（比如样本编号配错了模型版本）→ 点「驳回」，让标注团队重新处理<br />
            5. <strong>不要急着归正常</strong>，拿不准的可以在批次详情里留言问标注负责人周姐
          </div>
        </div>

        <Table
          columns={modelChangeColumns}
          dataSource={data.modelVersionChangedSamples}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1500 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条待复核`
          }}
          locale={{
            emptyText: '暂无待复核的模型版本变更记录 🎉'
          }}
        />
      </div>

      <div className="card-section">
        <h2>📜 最近操作动态</h2>
        <Table
          columns={recentColumns}
          dataSource={data.recentOperations}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </div>

      <div className="card-section">
        <h2>📖 边界规则说明</h2>
        <Collapse defaultActiveKey={['1']}>
          {boundaryRules.map((rule, index) => (
            <Panel 
              header={
                <Space>
                  <Tag color={rule.requireReview ? 'orange' : 'green'}>
                    {rule.requireReview ? '需要复核' : '自动处理'}
                  </Tag>
                  <strong>{rule.name}</strong>
                </Space>
              } 
              key={String(index + 1)}
            >
              <p><strong>触发条件：</strong>{rule.description}</p>
              <p><strong>自动标记状态：</strong>
                <Tag color={SAMPLE_STATUS_COLOR[rule.autoStatus]}>
                  {rule.autoStatusLabel}
                </Tag>
              </p>
              <p><strong>解释文案：</strong>{rule.explanation}</p>
              {rule.code === 'MODEL_VERSION_CHANGED_SAME_ID' && (
                <div className="next-action-box">
                  <div className="title">🔧 怎么判？怎么改？怎么回滚？</div>
                  <div className="content">
                    <strong>怎么判：</strong>先看是不是模型正常迭代。如果是模型升级了，故意拿旧样本测效果 → 通过；
                    如果是样本编号和模型版本配错了 → 驳回。<br />
                    <strong>怎么改：</strong>复核通过后状态变为「复核通过」，驳回后变为「复核驳回」。
                    可以在批次详情页补充留言，也可以人工修改字段。<br />
                    <strong>怎么回滚：</strong>在批次详情页点「回滚」按钮，状态会变为「已回滚」，
                    所有操作都会留日志，随时可查。
                  </div>
                </div>
              )}
            </Panel>
          ))}
        </Collapse>
      </div>

      <Modal
        title="驳回复核 - 请填写原因"
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false)
          rejectForm.resetFields()
          setSelectedSample(null)
        }}
        footer={null}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <p><strong>样本编号：</strong>{selectedSample?.sampleId}</p>
          <p><strong>当前状态：</strong>模型版本变更待复核</p>
        </div>
        <Form
          form={rejectForm}
          layout="vertical"
          onFinish={handleReviewReject}
        >
          <Form.Item
            name="reason"
            label="驳回原因"
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <Input.TextArea 
              rows={4} 
              placeholder="请详细说明驳回原因，如：样本编号与模型版本不匹配、数据错误等..." 
            />
          </Form.Item>
          <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setRejectModalVisible(false)}>取消</Button>
              <Button type="primary" danger htmlType="submit">确认驳回</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ReviewDashboard
