import React, { useState } from 'react'
import {
  Card,
  Empty,
  Button,
  Row,
  Col,
  Statistic,
  Checkbox,
  Typography,
  Divider,
  Alert,
  Steps,
} from 'antd'
import {
  FileTextOutlined,
  TableOutlined,
  CodeOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
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
const { Step } = Steps

declare global {
  interface Window {
    electronAPI: {
      exportMarkdown: (data: any, savePath?: string) => Promise<string | null>
      exportCSV: (data: any, savePath?: string) => Promise<string | null>
      exportJSON: (data: any, savePath?: string) => Promise<string | null>
    }
  }
}

interface ExportPageProps {
  appState: {
    currentProject: Project | null
    scenes: Scene[]
    propStatus: PropStatus[]
    actorCalls: ActorCall[]
    photos: PhotoInfo[]
    issues: ValidationIssue[]
    reviews: Review[]
  }
  onMessage: (type: 'success' | 'error' | 'info', content: string) => void
}

function ExportPage({ appState, onMessage }: ExportPageProps) {
  const { currentProject, scenes, propStatus, actorCalls, photos, issues, reviews } = appState
  const [includeResolved, setIncludeResolved] = useState(true)
  const [includeDismissed, setIncludeDismissed] = useState(false)
  const [exporting, setExporting] = useState(false)

  const hasData = issues.length > 0 || scenes.length > 0

  // 统计信息
  const criticalCount = issues.filter((i) => i.severity === 'critical').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const infoCount = issues.filter((i) => i.severity === 'info').length

  const confirmedCount = reviews.filter((r) => r.status === 'confirmed').length
  const dismissedCount = reviews.filter((r) => r.status === 'dismissed').length
  const resolvedCount = reviews.filter((r) => r.status === 'resolved').length
  const pendingCount = reviews.filter((r) => r.status === 'needs_more_info').length

  // 准备导出数据
  const prepareExportData = () => {
    return {
      project: currentProject || {
        id: 'default',
        name: '未命名项目',
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scenes,
        propStatus,
        actorCalls,
        photos,
        issues,
      },
      issues: issues.filter((issue) => {
        const review = reviews.find((r) => r.issueId === issue.id)
        if (!review) return true
        if (review.status === 'dismissed' && !includeDismissed) return false
        if (review.status === 'resolved' && !includeResolved) return false
        return true
      }),
      reviews: reviews.filter((review) => {
        if (review.status === 'dismissed' && !includeDismissed) return false
        if (review.status === 'resolved' && !includeResolved) return false
        return true
      }),
    }
  }

  // 导出 Markdown
  const handleExportMarkdown = async () => {
    if (!hasData) {
      onMessage('error', '没有可导出的数据')
      return
    }

    setExporting(true)
    try {
      const result = await window.electronAPI.exportMarkdown(prepareExportData())
      if (result) {
        onMessage('success', `Markdown复盘单已导出: ${result}`)
      }
    } catch (error) {
      onMessage('error', '导出失败')
    } finally {
      setExporting(false)
    }
  }

  // 导出 CSV
  const handleExportCSV = async () => {
    if (!hasData) {
      onMessage('error', '没有可导出的数据')
      return
    }

    setExporting(true)
    try {
      const result = await window.electronAPI.exportCSV(prepareExportData())
      if (result) {
        onMessage('success', `CSV问题表已导出: ${result}`)
      }
    } catch (error) {
      onMessage('error', '导出失败')
    } finally {
      setExporting(false)
    }
  }

  // 导出 JSON
  const handleExportJSON = async () => {
    if (!hasData) {
      onMessage('error', '没有可导出的数据')
      return
    }

    setExporting(true)
    try {
      const result = await window.electronAPI.exportJSON(prepareExportData())
      if (result) {
        onMessage('success', `JSON审计包已导出: ${result}`)
      }
    } catch (error) {
      onMessage('error', '导出失败')
    } finally {
      setExporting(false)
    }
  }

  if (!hasData) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Title level={4}>暂无数据</Title>
              <Text type="secondary">请先导入数据并进行连续性分析</Text>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <Title level={3}>导出报告</Title>
      <Text type="secondary">
        导出连续性核对报告，支持多种格式：Markdown复盘单、CSV问题表、JSON审计包。
      </Text>

      <Divider />

      {currentProject && (
        <Card style={{ marginBottom: '24px' }}>
          <Title level={4}>项目信息</Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Text strong>项目名称: </Text>
              <Text>{currentProject.name}</Text>
            </Col>
            <Col xs={24} sm={12}>
              <Text strong>创建时间: </Text>
              <Text>{currentProject.createdAt}</Text>
            </Col>
            {currentProject.description && (
              <Col span={24}>
                <Text strong>描述: </Text>
                <Text>{currentProject.description}</Text>
              </Col>
            )}
          </Row>
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="场景数"
              value={scenes.length}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="道具/服装记录"
              value={propStatus.length}
              prefix={<TableOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="问题数"
              value={issues.length}
              prefix={<CodeOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="导出选项" style={{ marginBottom: '24px' }}>
        <Checkbox
          checked={includeResolved}
          onChange={(e) => setIncludeResolved(e.target.checked)}
        >
          包含已解决的问题
        </Checkbox>
        <br />
        <Checkbox
          checked={includeDismissed}
          onChange={(e) => setIncludeDismissed(e.target.checked)}
        >
          包含已忽略的问题
        </Checkbox>
      </Card>

      <Title level={4}>选择导出格式</Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card
            hoverable
            title={
              <span>
                <FileTextOutlined style={{ marginRight: '8px' }} />
                Markdown 复盘单
              </span>
            }
            extra={<Tag color="blue">推荐</Tag>}
            actions={[
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExportMarkdown}
                loading={exporting}
              >
                导出
              </Button>,
            ]}
          >
            <Paragraph type="secondary">
              导出完整的连续性核对复盘单，包含项目信息、问题统计、问题详情和场景列表。
              适合打印分享或作为正式文档存档。
            </Paragraph>
            <div style={{ marginTop: '12px' }}>
              <Text strong>包含内容: </Text>
              <div style={{ marginTop: '4px' }}>
                <Tag>项目信息</Tag>
                <Tag style={{ marginLeft: '4px' }}>问题统计</Tag>
                <Tag style={{ marginLeft: '4px' }}>问题详情</Tag>
                <Tag style={{ marginLeft: '4px' }}>复核意见</Tag>
                <Tag style={{ marginLeft: '4px' }}>场景列表</Tag>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            hoverable
            title={
              <span>
                <TableOutlined style={{ marginRight: '8px' }} />
                CSV 问题表
              </span>
            }
            actions={[
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExportCSV}
                loading={exporting}
              >
                导出
              </Button>,
            ]}
          >
            <Paragraph type="secondary">
              导出问题列表为 CSV 格式，方便导入 Excel 或其他表格软件进行进一步分析。
              包含所有问题的完整信息。
            </Paragraph>
            <div style={{ marginTop: '12px' }}>
              <Text strong>包含字段: </Text>
              <div style={{ marginTop: '4px' }}>
                <Tag>问题ID</Tag>
                <Tag style={{ marginLeft: '4px' }}>标题</Tag>
                <Tag style={{ marginLeft: '4px' }}>类型</Tag>
                <Tag style={{ marginLeft: '4px' }}>严重级别</Tag>
                <Tag style={{ marginLeft: '4px' }}>描述</Tag>
                <Tag style={{ marginLeft: '4px' }}>涉及场景</Tag>
                <Tag style={{ marginLeft: '4px' }}>复核状态</Tag>
                <Tag style={{ marginLeft: '4px' }}>复核意见</Tag>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            hoverable
            title={
              <span>
                <CodeOutlined style={{ marginRight: '8px' }} />
                JSON 审计包
              </span>
            }
            actions={[
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExportJSON}
                loading={exporting}
              >
                导出
              </Button>,
            ]}
          >
            <Paragraph type="secondary">
              导出完整的审计数据包为 JSON 格式，包含所有原始数据。
              适合程序处理或与其他系统集成。
            </Paragraph>
            <div style={{ marginTop: '12px' }}>
              <Text strong>包含数据: </Text>
              <div style={{ marginTop: '4px' }}>
                <Tag>版本信息</Tag>
                <Tag style={{ marginLeft: '4px' }}>项目信息</Tag>
                <Tag style={{ marginLeft: '4px' }}>统计摘要</Tag>
                <Tag style={{ marginLeft: '4px' }}>所有问题</Tag>
                <Tag style={{ marginLeft: '4px' }}>所有复核意见</Tag>
                <Tag style={{ marginLeft: '4px' }}>场景数据</Tag>
                <Tag style={{ marginLeft: '4px' }}>道具状态</Tag>
                <Tag style={{ marginLeft: '4px' }}>演员通告</Tag>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Alert
        message="导出提示"
        description={
          <div>
            <Paragraph>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              Markdown 复盘单: 适合人工阅读和打印，格式美观，包含完整的上下文信息。
            </Paragraph>
            <Paragraph>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              CSV 问题表: 适合导入 Excel 进行筛选、排序和进一步分析。
            </Paragraph>
            <Paragraph>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              JSON 审计包: 适合程序处理、数据备份或与其他系统集成，包含最完整的数据。
            </Paragraph>
          </div>
        }
        type="info"
        showIcon
      />
    </div>
  )
}

export default ExportPage
