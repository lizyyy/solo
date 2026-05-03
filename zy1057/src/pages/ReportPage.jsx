import React, { useState, useEffect } from 'react'
import {
  Card,
  Select,
  Button,
  Space,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Empty,
  Radio,
  Input,
  Divider,
  Tabs,
  List,
  message,
  DatePicker,
  Alert,
  Descriptions,
} from 'antd'
import {
  FileTextOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  ExportOutlined,
  FileMarkdownOutlined,
  FileHtmlOutlined,
  FileCsvOutlined,
  HistoryOutlined,
  SafetyOutlined,
  DatabaseOutlined,
  EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import Papa from 'papaparse'
import { projects as projectsAPI, timelines as timelinesAPI, materials as materialsAPI, dialog } from '../services/api'
import {
  runAllChecks,
  sortRisksByPriority,
  RISK_LEVELS,
  RISK_LEVEL_LABELS,
  RISK_TYPE_LABELS,
} from '../services/rulesEngine'
import { generateMarkdownReport, generateHTMLReport } from '../services/reportGenerator'

const { Option } = Select
const { RangePicker } = DatePicker
const { TabPane } = Tabs

const MATERIAL_TYPE_LABELS = {
  audio: '音频',
  video: '视频',
  image: '图片',
  font: '字体',
}

const ReportPage = () => {
  const [projects, setProjects] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(false)
  
  const [selectedProject, setSelectedProject] = useState(null)
  const [timelines, setTimelines] = useState([])
  const [checkResult, setCheckResult] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [projectsData, materialsData] = await Promise.all([
        projectsAPI.getAll(),
        materialsAPI.getAll(),
      ])
      setProjects(projectsData || [])
      setMaterials(materialsData || [])
    } catch (error) {
      message.error('加载数据失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleProjectChange = async (projectId) => {
    const project = projects.find(p => p.id === projectId)
    setSelectedProject(project || null)
    setCheckResult(null)
    
    if (project) {
      try {
        const timelinesData = await timelinesAPI.getByProject(projectId)
        setTimelines(timelinesData || [])
        
        if (timelinesData.length > 0) {
          const result = runAllChecks(
            project,
            timelinesData,
            materials,
            {
              isCommercial: true,
              attributionNotes: [],
            }
          )
          setCheckResult(result)
        }
      } catch (error) {
        message.error('加载时间轴失败: ' + error.message)
      }
    } else {
      setTimelines([])
    }
  }

  const getLevelBadge = (level) => {
    const configs = {
      [RISK_LEVELS.CRITICAL]: { color: '#ff4d4f', label: '严重' },
      [RISK_LEVELS.HIGH]: { color: '#ff7a45', label: '高' },
      [RISK_LEVELS.MEDIUM]: { color: '#faad14', label: '中' },
      [RISK_LEVELS.LOW]: { color: '#1890ff', label: '低' },
    }
    return configs[level] || configs[RISK_LEVELS.LOW]
  }

  const handleExportReport = async (format) => {
    if (!checkResult) {
      message.warning('请先选择一个项目')
      return
    }
    
    try {
      const ext = format === 'markdown' ? 'md' : format === 'html' ? 'html' : 'csv'
      const result = await dialog.saveFile({
        title: `导出 ${ext.toUpperCase()} 报告`,
        filters: [
          { name: `${ext.toUpperCase()} 文件`, extensions: [ext] },
        ],
      })
      
      if (!result.canceled && result.filePath) {
        let content
        if (format === 'markdown') {
          content = generateMarkdownReport(checkResult, selectedProject, timelines, materials)
        } else if (format === 'html') {
          content = generateHTMLReport(checkResult, selectedProject, timelines, materials)
        } else {
          const csvData = checkResult.risks.map(r => ({
            风险等级: RISK_LEVEL_LABELS[r.level],
            风险类型: RISK_TYPE_LABELS[r.type],
            素材名称: r.material_name,
            问题描述: r.message,
            详细信息: r.detail,
            处理建议: r.suggestion,
          }))
          content = Papa.unparse(csvData)
        }
        
        const fs = window.require ? window.require('fs') : null
        if (!fs) {
          message.error('当前环境不支持文件导出')
          return
        }
        
        fs.writeFileSync(result.filePath, content)
        message.success('导出成功: ' + result.filePath)
      }
    } catch (error) {
      message.error('导出失败: ' + error.message)
    }
  }

  const handleExportMaterials = async (format) => {
    try {
      const ext = format === 'csv' ? 'csv' : 'json'
      const result = await dialog.saveFile({
        title: `导出素材库 ${ext.toUpperCase()}`,
        filters: [
          { name: `${ext.toUpperCase()} 文件`, extensions: [ext] },
        ],
      })
      
      if (!result.canceled && result.filePath) {
        const fs = window.require ? window.require('fs') : null
        if (!fs) {
          message.error('当前环境不支持文件导出')
          return
        }
        
        let content
        if (format === 'csv') {
          const csvData = materials.map(m => ({
            素材名称: m.name,
            类型: MATERIAL_TYPE_LABELS[m.type] || m.type,
            授权来源: m.license_source || '-',
            可用平台: m.allowed_platforms?.join('、') || '无限制',
            允许客户: m.allowed_clients?.join('、') || '无限制',
            商用: m.commercial_allowed ? '允许' : '禁止',
            到期日: m.expire_date || '无限制',
            需要署名: m.requires_attribution ? '是' : '否',
            署名文本: m.attribution_text || '-',
            文件路径: m.file_path || '-',
            备注: m.notes || '-',
          }))
          content = Papa.unparse(csvData)
        } else {
          content = JSON.stringify({
            export_at: new Date().toISOString(),
            count: materials.length,
            materials: materials,
          }, null, 2)
        }
        
        fs.writeFileSync(result.filePath, content)
        message.success('导出成功: ' + result.filePath)
      }
    } catch (error) {
      message.error('导出失败: ' + error.message)
    }
  }

  const getFilteredMaterials = () => {
    let filtered = [...materials]
    
    if (searchText) {
      const lower = searchText.toLowerCase()
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(lower) ||
        (m.license_source && m.license_source.toLowerCase().includes(lower)) ||
        (m.notes && m.notes.toLowerCase().includes(lower))
      )
    }
    
    if (filterType) {
      filtered = filtered.filter(m => m.type === filterType)
    }
    
    return filtered
  }

  const filteredMaterials = getFilteredMaterials()

  const overallStats = {
    totalProjects: projects.length,
    totalMaterials: materials.length,
    materialsByType: {
      audio: materials.filter(m => m.type === 'audio').length,
      video: materials.filter(m => m.type === 'video').length,
      image: materials.filter(m => m.type === 'image').length,
      font: materials.filter(m => m.type === 'font').length,
    },
    expiringSoon: materials.filter(m => {
      if (!m.expire_date) return false
      const days = dayjs(m.expire_date).diff(dayjs(), 'day')
      return days >= 0 && days <= 14
    }).length,
    expired: materials.filter(m => {
      if (!m.expire_date) return false
      return dayjs(m.expire_date).diff(dayjs(), 'day') < 0
    }).length,
    nonCommercial: materials.filter(m => !m.commercial_allowed).length,
    needsAttribution: materials.filter(m => m.requires_attribution).length,
  }

  const materialColumns = [
    {
      title: '素材名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type) => (
        <Tag className={`tag-material-${type}`}>
          {MATERIAL_TYPE_LABELS[type] || type}
        </Tag>
      ),
    },
    {
      title: '授权来源',
      dataIndex: 'license_source',
      key: 'license_source',
      width: 150,
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '商用',
      dataIndex: 'commercial_allowed',
      key: 'commercial_allowed',
      width: 80,
      render: (allowed) => (
        <Tag color={allowed ? 'green' : 'red'}>
          {allowed ? '允许' : '禁止'}
        </Tag>
      ),
    },
    {
      title: '到期日',
      dataIndex: 'expire_date',
      key: 'expire_date',
      width: 120,
      render: (date) => {
        if (!date) return <Tag color="default">无限制</Tag>
        const daysUntil = dayjs(date).diff(dayjs(), 'day')
        let color = 'default'
        if (daysUntil < 0) color = 'red'
        else if (daysUntil <= 14) color = 'orange'
        else if (daysUntil <= 30) color = 'gold'
        return <Tag color={color}>{date}</Tag>
      },
    },
    {
      title: '需要署名',
      dataIndex: 'requires_attribution',
      key: 'requires_attribution',
      width: 80,
      render: (required) => (
        required ? <Tag color="purple">是</Tag> : <Tag color="default">否</Tag>
      ),
    },
    {
      title: '可用平台',
      dataIndex: 'allowed_platforms',
      key: 'allowed_platforms',
      width: 200,
      render: (platforms) => (
        <Space wrap size={[0, 4]}>
          {platforms?.length > 0 
            ? platforms.map(p => <Tag key={p} size="small">{p}</Tag>)
            : <Tag color="default">无限制</Tag>
          }
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <h2 style={{ margin: 0 }}>报告中心</h2>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                刷新
              </Button>
              <Button 
                icon={<FileCsvOutlined />} 
                onClick={() => handleExportMaterials('csv')}
              >
                导出素材库 CSV
              </Button>
              <Button 
                icon={<ExportOutlined />} 
                onClick={() => handleExportMaterials('json')}
              >
                导出素材库 JSON
              </Button>
              {checkResult && (
                <>
                  <Button 
                    icon={<FileMarkdownOutlined />} 
                    onClick={() => handleExportReport('markdown')}
                  >
                    Markdown
                  </Button>
                  <Button 
                    icon={<FileCsvOutlined />} 
                    onClick={() => handleExportReport('csv')}
                  >
                    风险 CSV
                  </Button>
                  <Button 
                    type="primary"
                    icon={<FileHtmlOutlined />} 
                    onClick={() => handleExportReport('html')}
                  >
                    HTML 报告
                  </Button>
                </>
              )}
            </Space>
          </Col>
        </Row>

        <Card title="项目选择" size="small" style={{ marginBottom: 24 }}>
          <Space>
            <Select
              placeholder="选择项目查看详细报告"
              style={{ width: 400 }}
              value={selectedProject?.id || undefined}
              onChange={handleProjectChange}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {projects.map(p => (
                <Option key={p.id} value={p.id}>
                  {p.name} ({p.client_name || '未指定客户'}) - {timelinesAPI.getByProject ? '加载中' : ''}
                </Option>
              ))}
            </Select>
            {selectedProject && (
              <span style={{ color: '#666' }}>
                时间轴片段: {timelines.length} 个
              </span>
            )}
          </Space>
        </Card>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={<span><SafetyOutlined /> 全局概览</span>} key="overview">
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="项目总数" 
                  value={overallStats.totalProjects}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="素材总数" 
                  value={overallStats.totalMaterials}
                  prefix={<DatabaseOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="14天内过期" 
                  value={overallStats.expiringSoon}
                  valueStyle={{ color: overallStats.expiringSoon > 0 ? '#faad14' : '#52c41a' }}
                  prefix={<HistoryOutlined />}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="已过期" 
                  value={overallStats.expired}
                  valueStyle={{ color: overallStats.expired > 0 ? '#ff4d4f' : '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="非商用素材" 
                  value={overallStats.nonCommercial}
                  valueStyle={{ color: '#ff7a45' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="需署名素材" 
                  value={overallStats.needsAttribution}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card title="素材类型分布" size="small">
                <List>
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Tag className="tag-material-audio">音频</Tag>}
                      description={`${overallStats.materialsByType.audio} 个`}
                    />
                  </List.Item>
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Tag className="tag-material-video">视频</Tag>}
                      description={`${overallStats.materialsByType.video} 个`}
                    />
                  </List.Item>
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Tag className="tag-material-image">图片</Tag>}
                      description={`${overallStats.materialsByType.image} 个`}
                    />
                  </List.Item>
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Tag className="tag-material-font">字体</Tag>}
                      description={`${overallStats.materialsByType.font} 个`}
                    />
                  </List.Item>
                </List>
              </Card>
            </Col>
            <Col span={9}>
              <Card title="风险素材提醒" size="small">
                {overallStats.expiringSoon + overallStats.expired + overallStats.nonCommercial === 0 ? (
                  <Empty description="无风险素材" style={{ margin: '20px 0' }} />
                ) : (
                  <List>
                    {overallStats.expiringSoon > 0 && (
                      <List.Item>
                        <Alert
                          message={`${overallStats.expiringSoon} 个素材将在 14 天内过期`}
                          type="warning"
                          showIcon
                        />
                      </List.Item>
                    )}
                    {overallStats.expired > 0 && (
                      <List.Item>
                        <Alert
                          message={`${overallStats.expired} 个素材已过期`}
                          type="error"
                          showIcon
                        />
                      </List.Item>
                    )}
                    {overallStats.nonCommercial > 0 && (
                      <List.Item>
                        <Alert
                          message={`${overallStats.nonCommercial} 个素材禁止商用`}
                          type="warning"
                          showIcon
                        />
                      </List.Item>
                    )}
                  </List>
                )}
              </Card>
            </Col>
            <Col span={9}>
              <Card title="需署名素材清单" size="small">
                {overallStats.needsAttribution === 0 ? (
                  <Empty description="无需要署名的素材" style={{ margin: '20px 0' }} />
                ) : (
                  <List
                    size="small"
                    dataSource={materials.filter(m => m.requires_attribution)}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          title={item.name}
                          description={
                            <span style={{ color: '#666' }}>
                              建议署名: <strong style={{ color: '#722ed1' }}>
                                {item.attribution_text || `素材来源: ${item.name}`}
                              </strong>
                            </span>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>
          </Row>

          <Card 
            title="素材库明细" 
            size="small"
            extra={
              <Space>
                <Select
                  placeholder="筛选类型"
                  allowClear
                  style={{ width: 120 }}
                  value={filterType}
                  onChange={setFilterType}
                >
                  <Option value="audio">音频</Option>
                  <Option value="video">视频</Option>
                  <Option value="image">图片</Option>
                  <Option value="font">字体</Option>
                </Select>
                <Input
                  placeholder="搜索素材"
                  prefix={<SearchOutlined />}
                  style={{ width: 200 }}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                />
              </Space>
            }
          >
            {filteredMaterials.length === 0 ? (
              <Empty description="暂无素材数据" />
            ) : (
              <Table
                columns={materialColumns}
                dataSource={filteredMaterials}
                rowKey="id"
                scroll={{ x: 1100 }}
                pagination={{
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 个素材`,
                  pageSize: 10,
                }}
              />
            )}
          </Card>
        </TabPane>

        <TabPane tab={<span><FileTextOutlined /> 项目报告</span>} key="project">
          {!selectedProject ? (
            <Empty
              className="empty-state"
              description={
                <div>
                  <p className="empty-state-text">请先选择一个项目</p>
                  <p style={{ marginTop: 8, color: '#999' }}>
                    从上方下拉框选择要查看报告的项目
                  </p>
                </div>
              }
            />
          ) : timelines.length === 0 ? (
            <Empty
              className="empty-state"
              description={
                <div>
                  <p className="empty-state-text">该项目没有时间轴片段</p>
                  <p style={{ marginTop: 8, color: '#999' }}>
                    请先在「成片/项目」页面添加时间轴片段
                  </p>
                </div>
              }
            />
          ) : !checkResult ? (
            <Empty
              className="empty-state"
              description={
                <div>
                  <p className="empty-state-text">无法生成报告</p>
                  <p style={{ marginTop: 8, color: '#999' }}>
                    请确保项目包含时间轴片段
                  </p>
                </div>
              }
            />
          ) : (
            <div>
              <Card title="项目摘要" size="small" style={{ marginBottom: 24 }}>
                <Descriptions bordered column={4}>
                  <Descriptions.Item label="项目名称">{selectedProject.name}</Descriptions.Item>
                  <Descriptions.Item label="客户">{selectedProject.client_name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="目标平台">
                    {selectedProject.target_platforms?.join('、') || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={
                      selectedProject.status === 'completed' ? 'success' :
                      selectedProject.status === 'review' ? 'warning' :
                      selectedProject.status === 'in_progress' ? 'processing' : 'default'
                    }>
                      {selectedProject.status === 'completed' ? '已完成' :
                       selectedProject.status === 'review' ? '审核中' :
                       selectedProject.status === 'in_progress' ? '制作中' : '草稿'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="时间轴片段数">{timelines.length}</Descriptions.Item>
                  <Descriptions.Item label="素材用量">
                    {checkResult.materialStats.total} 个
                  </Descriptions.Item>
                  <Descriptions.Item label="总风险数">
                    <Tag color={checkResult.stats.total > 0 ? 'red' : 'green'}>
                      {checkResult.stats.total}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="报告生成时间">
                    {dayjs(checkResult.checkTime).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={4}>
                  <Card>
                    <Statistic 
                      title="总风险" 
                      value={checkResult.stats.total}
                      valueStyle={{ color: checkResult.stats.total > 0 ? '#ff4d4f' : '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card>
                    <Statistic 
                      title="严重" 
                      value={checkResult.stats.critical}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card>
                    <Statistic 
                      title="高" 
                      value={checkResult.stats.high}
                      valueStyle={{ color: '#ff7a45' }}
                    />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card>
                    <Statistic 
                      title="中" 
                      value={checkResult.stats.medium}
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card>
                    <Statistic 
                      title="低" 
                      value={checkResult.stats.low}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card>
                    <Statistic 
                      title="需署名" 
                      value={checkResult.attributionList.length}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Card>
                </Col>
              </Row>

              {checkResult.stats.total === 0 ? (
                <Alert
                  message="✅ 恭喜！未检测到授权风险"
                  description="所有素材的授权检查均通过，可以放心交付。"
                  type="success"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              ) : (
                <Alert
                  message={`⚠️ 检测到 ${checkResult.stats.total} 个风险需要处理`}
                  description={`其中 ${checkResult.stats.critical} 个严重、${checkResult.stats.high} 个高风险，请优先处理。建议导出完整报告并逐一处理。`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              )}

              <Card title="风险明细" size="small" style={{ marginBottom: 24 }}>
                {checkResult.risks.length === 0 ? (
                  <Empty description="无风险记录" />
                ) : (
                  <Table
                    columns={[
                      {
                        title: '风险等级',
                        dataIndex: 'level',
                        key: 'level',
                        width: 100,
                        render: (level) => {
                          const config = getLevelBadge(level)
                          return <Tag color={config.color}>{config.label}</Tag>
                        },
                      },
                      {
                        title: '风险类型',
                        dataIndex: 'type',
                        key: 'type',
                        width: 120,
                        render: (type) => RISK_TYPE_LABELS[type] || type,
                      },
                      {
                        title: '素材名称',
                        dataIndex: 'material_name',
                        key: 'material_name',
                        width: 180,
                      },
                      {
                        title: '问题描述',
                        dataIndex: 'message',
                        key: 'message',
                        width: 250,
                      },
                      {
                        title: '处理建议',
                        dataIndex: 'suggestion',
                        key: 'suggestion',
                        width: 300,
                        render: (text) => (
                          <span style={{ color: '#1890ff' }}>💡 {text}</span>
                        ),
                      },
                    ]}
                    dataSource={sortRisksByPriority(checkResult.risks)}
                    rowKey={(record, index) => `${record.type}-${record.timeline_id}-${index}`}
                    scroll={{ x: 1000 }}
                    pagination={{
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 个风险`,
                      pageSize: 10,
                    }}
                    rowClassName={(record) => `risk-${record.level}`}
                  />
                )}
              </Card>

              {checkResult.attributionList.length > 0 && (
                <Card 
                  title={
                    <Space>
                      <EditOutlined />
                      <span>待补充署名清单</span>
                    </Space>
                  }
                  size="small"
                >
                  <List
                    bordered
                    dataSource={checkResult.attributionList}
                    renderItem={(item, index) => (
                      <List.Item>
                        <Row style={{ width: '100%' }}>
                          <Col span={2}>
                            <Tag color="purple">#{index + 1}</Tag>
                          </Col>
                          <Col span={8}>
                            <strong>{item.material_name}</strong>
                          </Col>
                          <Col span={14}>
                            <span style={{ color: '#666' }}>建议署名文本: </span>
                            <strong style={{ color: '#1890ff' }}>{item.attribution_text}</strong>
                          </Col>
                        </Row>
                      </List.Item>
                    )}
                  />
                </Card>
              )}
            </div>
          )}
        </TabPane>
      </Tabs>
    </div>
  )
}

export default ReportPage
