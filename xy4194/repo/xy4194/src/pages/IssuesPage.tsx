import React, { useState } from 'react'
import {
  Card,
  Empty,
  Tag,
  Typography,
  List,
  Select,
  Row,
  Col,
  Button,
  Modal,
  Input,
  Statistic,
  Divider,
  Collapse,
  Badge,
} from 'antd'
import {
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type {
  Project,
  Scene,
  PropStatus,
  ActorCall,
  PhotoInfo,
  ValidationIssue,
  Review,
} from '../types'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { TextArea } = Input
const { Panel } = Collapse

declare global {
  interface Window {
    electronAPI: {
      getReviewByIssueId: (issueId: string) => Promise<Review | null>
      saveReview: (review: any) => Promise<Review>
      getReviewsByProjectId?: (projectId: string) => Promise<Review[]>
    }
  }
}

interface IssuesPageProps {
  appState: {
    currentProject: Project | null
    scenes: Scene[]
    propStatus: PropStatus[]
    actorCalls: ActorCall[]
    photos: PhotoInfo[]
    issues: ValidationIssue[]
    reviews: Review[]
  }
  onUpdateData: (updates: Partial<{
    currentProject: Project | null
    scenes: Scene[]
    propStatus: PropStatus[]
    actorCalls: ActorCall[]
    photos: PhotoInfo[]
    issues: ValidationIssue[]
    reviews: Review[]
  }>) => void
  onMessage: (type: 'success' | 'error' | 'info', content: string) => void
}

const typeNames: Record<string, string> = {
  prop_state_jump: '道具状态跳变',
  costume_missing: '服装缺记录',
  photo_missing: '照片证据缺失',
  reshoot_date_conflict: '补拍日期冲突',
  timeline_inconsistency: '时间线不一致',
  actor_schedule_conflict: '演员日程冲突',
  wound_continuity: '伤口连续性',
  makeup_continuity: '妆容连续性',
}

function IssuesPage({ appState, onUpdateData, onMessage }: IssuesPageProps) {
  const { issues, reviews, currentProject } = appState
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<ValidationIssue | null>(null)
  const [reviewStatus, setReviewStatus] = useState<string>('needs_more_info')
  const [reviewComment, setReviewComment] = useState('')
  const [reviewerName, setReviewerName] = useState('场记')

  const hasData = issues.length > 0

  // 统计信息
  const criticalCount = issues.filter((i) => i.severity === 'critical').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const infoCount = issues.filter((i) => i.severity === 'info').length

  const confirmedCount = reviews.filter((r) => r.status === 'confirmed').length
  const dismissedCount = reviews.filter((r) => r.status === 'dismissed').length
  const resolvedCount = reviews.filter((r) => r.status === 'resolved').length
  const pendingCount = reviews.filter((r) => r.status === 'needs_more_info').length

  // 获取问题的复核状态
  const getReviewForIssue = (issueId: string): Review | undefined => {
    return reviews.find((r) => r.issueId === issueId)
  }

  // 筛选问题
  const filteredIssues = issues.filter((issue) => {
    const matchesSeverity =
      selectedSeverity === 'all' || issue.severity === selectedSeverity
    const matchesType = selectedType === 'all' || issue.type === selectedType

    const review = getReviewForIssue(issue.id)
    let matchesStatus = selectedStatus === 'all'
    
    if (selectedStatus === 'unreviewed') {
      matchesStatus = !review
    } else if (selectedStatus === 'pending') {
      matchesStatus = review?.status === 'needs_more_info'
    } else if (selectedStatus) {
      matchesStatus = review?.status === selectedStatus
    }

    return matchesSeverity && matchesType && matchesStatus
  })

  // 所有问题类型
  const allTypes = Array.from(new Set(issues.map((i) => i.type)))

  // 打开复核模态框
  const openReviewModal = (issue: ValidationIssue) => {
    setSelectedIssue(issue)
    const review = getReviewForIssue(issue.id)
    if (review) {
      setReviewStatus(review.status)
      setReviewComment(review.comment)
      setReviewerName(review.reviewerName)
    } else {
      setReviewStatus('needs_more_info')
      setReviewComment('')
    }
    setModalVisible(true)
  }

  // 保存复核意见
  const saveReview = async () => {
    if (!selectedIssue) return

    try {
      const review = await window.electronAPI.saveReview({
        issueId: selectedIssue.id,
        projectId: currentProject?.id || 'default',
        status: reviewStatus,
        reviewerName: reviewerName,
        comment: reviewComment,
      })

      // 更新本地状态
      const existingIndex = reviews.findIndex((r) => r.issueId === selectedIssue.id)
      let updatedReviews
      if (existingIndex >= 0) {
        updatedReviews = [...reviews]
        updatedReviews[existingIndex] = review
      } else {
        updatedReviews = [...reviews, review]
      }

      onUpdateData({ reviews: updatedReviews })
      setModalVisible(false)
      onMessage('success', '复核意见已保存')
    } catch (error) {
      onMessage('error', '保存失败')
    }
  }

  const severityColors: Record<string, string> = {
    critical: 'red',
    warning: 'orange',
    info: 'blue',
  }

  const severityNames: Record<string, string> = {
    critical: '严重',
    warning: '警告',
    info: '信息',
  }

  const statusColors: Record<string, string> = {
    confirmed: 'success',
    dismissed: 'default',
    resolved: 'processing',
    needs_more_info: 'warning',
  }

  const statusNames: Record<string, string> = {
    confirmed: '已确认',
    dismissed: '已忽略',
    resolved: '已解决',
    needs_more_info: '待确认',
  }

  if (!hasData) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Title level={4}>暂无问题</Title>
              <Text type="secondary">请先导入数据并进行连续性分析</Text>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <Title level={3}>问题列表</Title>
      <Text type="secondary">
        系统检测到的连续性问题列表。您可以对每个问题进行复核，并记录复核意见。
      </Text>

      <Divider />

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="严重问题"
              value={criticalCount}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="警告"
              value={warningCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="信息"
              value={infoCount}
              valueStyle={{ color: '#1890ff' }}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已复核"
              value={reviews.length}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              suffix={`/ ${issues.length}`}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Text strong>严重级别: </Text>
            <Select
              style={{ width: '120px', marginLeft: '8px' }}
              value={selectedSeverity}
              onChange={setSelectedSeverity}
            >
              <Option value="all">全部</Option>
              <Option value="critical">严重</Option>
              <Option value="warning">警告</Option>
              <Option value="info">信息</Option>
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Text strong>问题类型: </Text>
            <Select
              style={{ width: '150px', marginLeft: '8px' }}
              value={selectedType}
              onChange={setSelectedType}
            >
              <Option value="all">全部</Option>
              {allTypes.map((type) => (
                <Option key={type} value={type}>
                  {typeNames[type] || type}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Text strong>复核状态: </Text>
            <Select
              style={{ width: '120px', marginLeft: '8px' }}
              value={selectedStatus}
              onChange={setSelectedStatus}
            >
              <Option value="all">全部</Option>
              <Option value="unreviewed">未复核</Option>
              <Option value="needs_more_info">待确认</Option>
              <Option value="confirmed">已确认</Option>
              <Option value="dismissed">已忽略</Option>
              <Option value="resolved">已解决</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {filteredIssues.length === 0 ? (
        <Empty description="没有符合筛选条件的问题" />
      ) : (
        <Collapse
          accordion
          items={filteredIssues.map((issue, index) => {
            const review = getReviewForIssue(issue.id)
            
            return {
              key: issue.id,
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <Text strong>[{index + 1}]</Text>
                  <Tag color={severityColors[issue.severity]}>
                    {severityNames[issue.severity]}
                  </Tag>
                  <Tag>{typeNames[issue.type] || issue.type}</Tag>
                  <Text style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {issue.title}
                  </Text>
                  {review ? (
                    <Tag color={statusColors[review.status]}>
                      {statusNames[review.status]}
                    </Tag>
                  ) : (
                    <Badge status="default" text="未复核" />
                  )}
                </div>
              ),
              children: (
                <div>
                  <Paragraph>
                    <Text strong>描述: </Text>
                    {issue.description}
                  </Paragraph>

                  {issue.affectedScenes.length > 0 && (
                    <Paragraph>
                      <Text strong>涉及场景: </Text>
                      {issue.affectedScenes.map((s) => (
                        <Tag key={s} color="blue">
                          {s}
                        </Tag>
                      ))}
                    </Paragraph>
                  )}

                  {issue.affectedActors.length > 0 && (
                    <Paragraph>
                      <Text strong>涉及演员: </Text>
                      {issue.affectedActors.map((a) => (
                        <Tag key={a} color="cyan">
                          {a}
                        </Tag>
                      ))}
                    </Paragraph>
                  )}

                  {issue.affectedProps.length > 0 && (
                    <Paragraph>
                      <Text strong>涉及道具: </Text>
                      {issue.affectedProps.map((p) => (
                        <Tag key={p} color="green">
                          {p}
                        </Tag>
                      ))}
                    </Paragraph>
                  )}

                  {issue.evidence.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <Text strong>证据: </Text>
                      <List
                        size="small"
                        style={{ marginTop: '8px' }}
                        dataSource={issue.evidence}
                        renderItem={(ev) => (
                          <List.Item>
                            <Tag>{ev.type}</Tag>
                            <Text>{ev.description}</Text>
                          </List.Item>
                        )}
                      />
                    </div>
                  )}

                  <Paragraph
                    style={{
                      padding: '12px',
                      backgroundColor: '#e6f7ff',
                      borderRadius: '4px',
                      marginBottom: '16px',
                    }}
                  >
                    <Text strong>建议: </Text>
                    {issue.suggestion}
                  </Paragraph>

                  {review && (
                    <Card
                      size="small"
                      title="复核意见"
                      style={{ marginBottom: '16px' }}
                      extra={
                        <Tag color={statusColors[review.status]}>
                          {statusNames[review.status]}
                        </Tag>
                      }
                    >
                      <Paragraph>
                        <Text strong>复核人: </Text>
                        {review.reviewerName}
                      </Paragraph>
                      {review.comment && (
                        <Paragraph>
                          <Text strong>意见: </Text>
                          {review.comment}
                        </Paragraph>
                      )}
                      <Text type="secondary">最后更新: {review.updatedAt}</Text>
                    </Card>
                  )}

                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => openReviewModal(issue)}
                  >
                    {review ? '修改复核意见' : '添加复核意见'}
                  </Button>
                </div>
              ),
            }
          })}
        />
      )}

      {/* 复核模态框 */}
      <Modal
        title="复核问题"
        open={modalVisible}
        onOk={saveReview}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        {selectedIssue && (
          <div>
            <Card size="small" style={{ marginBottom: '16px' }}>
              <Tag color={severityColors[selectedIssue.severity]} style={{ marginRight: '8px' }}>
                {severityNames[selectedIssue.severity]}
              </Tag>
              <Tag>{typeNames[selectedIssue.type] || selectedIssue.type}</Tag>
              <Paragraph style={{ marginTop: '8px', marginBottom: 0 }}>
                <Text strong>{selectedIssue.title}</Text>
              </Paragraph>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {selectedIssue.description}
              </Paragraph>
            </Card>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Text strong>复核人: </Text>
                <Input
                  style={{ width: '200px', marginLeft: '8px' }}
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="请输入复核人姓名"
                />
              </Col>
              <Col span={24}>
                <Text strong>复核状态: </Text>
                <Select
                  style={{ width: '150px', marginLeft: '8px' }}
                  value={reviewStatus}
                  onChange={setReviewStatus}
                >
                  <Option value="needs_more_info">待确认</Option>
                  <Option value="confirmed">已确认</Option>
                  <Option value="dismissed">已忽略</Option>
                  <Option value="resolved">已解决</Option>
                </Select>
              </Col>
              <Col span={24}>
                <Text strong>复核意见: </Text>
                <TextArea
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="请输入复核意见..."
                  style={{ marginTop: '8px' }}
                />
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default IssuesPage
