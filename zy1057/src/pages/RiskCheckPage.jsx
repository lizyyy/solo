import React, { useState, useEffect } from 'react'
import {
  Card,
  Select,
  Button,
  Form,
  Switch,
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
  Collapse,
  Badge,
  Alert,
  Tabs,
  List,
  Popconfirm,
  message,
} from 'antd'
import {
  AlertOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  SafetyOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  DatabaseOutlined,
  EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
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
const { TextArea } = Input
const { TabPane } = Tabs
const { Panel } = Collapse

const PLATFORMS = ['抖音', '小红书', 'B站', '微信视频号', '微博', '快手', 'YouTube', '其他']

const RiskCheckPage = () => {
  const [projects, setProjects] = useState([])
  const [materials, setMaterials] = useState([])
  const [timelines, setTimelines] = useState([])
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  
  const [selectedProject, setSelectedProject] = useState(null)
  const [checkResult, setCheckResult] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  
  const [filterLevel, setFilterLevel] = useState(null)
  const [filterType, setFilterType] = useState(null)
  const [searchText, setSearchText] = useState('')
  
  const [form] = Form.useForm()

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
        
        form.setFieldsValue({
          isCommercial: true,
          attributionNotes: '',
        })
      } catch (error) {
        message.error('加载时间轴失败: ' + error.message)
      }
    } else {
      setTimelines([])
    }
  }

  const handleRunCheck = async () => {
    if (!selectedProject) {
      message.warning('请先选择一个项目')
      return
    }
    
    if (timelines.length === 0) {
      message.warning('该项目没有时间轴片段，无法进行检查')
      return
    }
    
    setChecking(true)
    
    try {
      const values = form.getFieldsValue()
      
      const attributionNotes = values.attributionNotes
        ? values.attributionNotes.split(/\n/).filter(Boolean)
        : []
      
      const result = runAllChecks(
        selectedProject,
        timelines,
        materials,
        {
          isCommercial: values.isCommercial,
          attributionNotes,
        }
      )
      
      setCheckResult(result)
      message.success(`检查完成，共发现 ${result.stats.total} 个风险`)
    } catch (error) {
      message.error('检查失败: ' + error.message)
    } finally {
      setChecking(false)
    }
  }

  const getFilteredRisks = () => {
    if (!checkResult) return []
    
    let risks = [...checkResult.risks]
    
    if (activeTab === 'critical') {
      risks = risks.filter(r => r.level === RISK_LEVELS.CRITICAL)
    } else if (activeTab === 'high') {
      risks = risks.filter(r => r.level === RISK_LEVELS.HIGH)
    } else if (activeTab === 'medium') {
      risks = risks.filter(r => r.level === RISK_LEVELS.MEDIUM)
    }
    
    if (filterLevel) {
      risks = risks.filter(r => r.level === filterLevel)
    }
    
    if (filterType) {
      risks = risks.filter(r => r.type === filterType)
    }
    
    if (searchText) {
      const lower = searchText.toLowerCase()
      risks = risks.filter(r => 
        r.material_name?.toLowerCase().includes(lower) ||
        r.message?.toLowerCase().includes(lower) ||
        r.detail?.toLowerCase().includes(lower)
      )
    }
    
    return sortRisksByPriority(risks)
  }

  const getLevelBadge = (level) => {
    const configs = {
      [RISK_LEVELS.CRITICAL]: { color: '#ff4d4f', label: '严重', bg: '#fff1f0' },
      [RISK_LEVELS.HIGH]: { color: '#ff7a45', label: '高', bg: '#fff7e6' },
      [RISK_LEVELS.MEDIUM]: { color: '#faad14', label: '中', bg: '#fffbe6' },
      [RISK_LEVELS.LOW]: { color: '#1890ff', label: '低', bg: '#e6f7ff' },
    }
    return configs[level] || configs[RISK_LEVELS.LOW]
  }

  const handleExportReport = async (format) => {
    if (!checkResult) {
      message.warning('请先运行检查')
      return
    }
    
    try {
      const ext = format === 'markdown' ? 'md' : 'html'
      const result = await dialog.saveFile({
        title: '导出报告',
        filters: [
          { name: `${ext.toUpperCase()} 文件`, extensions: [ext] },
        ],
      })
      
      if (!result.canceled && result.filePath) {
        let content
        if (format === 'markdown') {
          content = generateMarkdownReport(checkResult, selectedProject, timelines, materials)
        } else {
          content = generateHTMLReport(checkResult, selectedProject, timelines, materials)
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

  const filteredRisks = getFilteredRisks()

  const riskColumns = [
    {
      title: '风险等级',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level) => {
        const config = getLevelBadge(level)
        return (
          <Tag color={config.color} style={{ fontSize: 13, padding: '2px 8px' }}>
            {config.label}
          </Tag>
        )
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
      ellipsis: true,
    },
    {
      title: '问题描述',
      dataIndex: 'message',
      key: 'message',
      width: 250,
      ellipsis: true,
    },
    {
      title: '处理建议',
      dataIndex: 'suggestion',
      key: 'suggestion',
      width: 250,
      ellipsis: true,
      render: (text) => (
        <span style={{ color: '#1890ff' }}>💡 {text}</span>
      ),
    },
  ]

  const expandRowRender = (record) => (
    <div style={{ padding: '16px 24px', background: '#fafafa' }}>
      <Row gutter={24}>
        <Col span={12}>
          <h4 style={{ marginBottom: 8, color: '#333' }}>详细信息</h4>
          <p style={{ margin: '4px 0', color: '#666' }}>
            <strong>素材名称:</strong> {record.material_name}
          </p>
          <p style={{ margin: '4px 0', color: '#666' }}>
            <strong>问题描述:</strong> {record.message}
          </p>
          <p style={{ margin: '4px 0', color: '#666' }}>
            <strong>详细信息:</strong> {record.detail}
          </p>
          {record.expire_date && (
            <p style={{ margin: '4px 0', color: '#666' }}>
              <strong>到期日:</strong> {record.expire_date}
              {record.days_until_expire != null && (
                <span style={{ 
                  color: record.days_until_expire < 0 ? '#ff4d4f' : '#faad14' 
                }}>
                  {' '}({record.days_until_expire < 0 
                    ? `已过期 ${Math.abs(record.days_until_expire)} 天` 
                    : `剩余 ${record.days_until_expire} 天`})
                </span>
              )}
            </p>
          )}
        </Col>
        <Col span={12}>
          <h4 style={{ marginBottom: 8, color: '#333' }}>处理建议</h4>
          <Alert
            message="建议操作"
            description={record.suggestion}
            type="info"
            showIcon
          />
          <Divider style={{ margin: '12px 0' }} />
          <h4 style={{ marginBottom: 8, color: '#333' }}>相关素材</h4>
          {materials.find(m => m.id === record.material_id) ? (
            <div>
              <p style={{ margin: '4px 0' }}>
                <strong>授权来源:</strong> {materials.find(m => m.id === record.material_id)?.license_source || '-'}
              </p>
              <p style={{ margin: '4px 0' }}>
                <strong>可用平台:</strong> {materials.find(m => m.id === record.material_id)?.allowed_platforms?.join('、') || '无限制'}
              </p>
              <p style={{ margin: '4px 0' }}>
                <strong>商用:</strong> {materials.find(m => m.id === record.material_id)?.commercial_allowed ? '允许' : '禁止'}
              </p>
            </div>
          ) : (
            <p style={{ color: '#999' }}>该素材未在素材库中</p>
          )}
        </Col>
      </Row>
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <h2 style={{ margin: 0 }}>授权检查</h2>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                刷新数据
              </Button>
              {checkResult && (
                <>
                  <Button 
                    icon={<ExportOutlined />} 
                    onClick={() => handleExportReport('markdown')}
                  >
                    导出 Markdown
                  </Button>
                  <Button 
                    type="primary"
                    icon={<ExportOutlined />} 
                    onClick={() => handleExportReport('html')}
                  >
                    导出 HTML 报告
                  </Button>
                </>
              )}
            </Space>
          </Col>
        </Row>

        <Card title="检查配置" size="small">
          <Form
            form={form}
            layout="inline"
            initialValues={{
              isCommercial: true,
              attributionNotes: '',
            }}
          >
            <Form.Item label="选择项目" required style={{ minWidth: 250 }}>
              <Select
                placeholder="请选择要检查的项目"
                style={{ width: 300 }}
                value={selectedProject?.id || undefined}
                onChange={handleProjectChange}
                allowClear
                showSearch
                optionFilterProp="children"
              >
                {projects.map(p => (
                  <Option key={p.id} value={p.id}>
                    {p.name} ({p.client_name || '未指定客户'})
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {selectedProject && (
              <>
                <Form.Item name="isCommercial" label="商用用途" valuePropName="checked">
                  <Switch checkedChildren="是" unCheckedChildren="否" />
                </Form.Item>

                <Form.Item name="attributionNotes" label="已添加的署名（每行一个）">
                  <TextArea
                    placeholder="输入已在片尾/描述中添加的署名文本，每行一个"
                    style={{ width: 300 }}
                    rows={2}
                  />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleRunCheck}
                    loading={checking}
                  >
                    运行检查
                  </Button>
                </Form.Item>
              </>
            )}
          </Form>

          {selectedProject && (
            <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
              <Row gutter={24}>
                <Col span={6}>
                  <Statistic 
                    title="项目名称" 
                    value={selectedProject.name} 
                    valueStyle={{ fontSize: 14, color: '#333' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="客户" 
                    value={selectedProject.client_name || '-'} 
                    valueStyle={{ fontSize: 14, color: '#333' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="目标平台" 
                    value={selectedProject.target_platforms?.join('、') || '-'} 
                    valueStyle={{ fontSize: 14, color: '#333' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="时间轴片段数" 
                    value={timelines.length} 
                    valueStyle={{ fontSize: 14, color: '#722ed1' }}
                  />
                </Col>
              </Row>
            </div>
          )}
        </Card>
      </div>

      {!selectedProject ? (
        <Empty
          className="empty-state"
          description={
            <div>
              <p className="empty-state-text">请先选择一个项目</p>
              <p style={{ marginTop: 8, color: '#999' }}>
                从上方下拉框选择要检查的项目，然后点击「运行检查」
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
              <SafetyOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
              <p className="empty-state-text" style={{ marginTop: 16 }}>
                点击「运行检查」开始授权体检
              </p>
              <p style={{ marginTop: 8, color: '#999' }}>
                系统将检查：平台匹配、商用权限、授权有效期、客户限制、署名要求等
              </p>
            </div>
          }
        />
      ) : (
        <div>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={4}>
              <Card>
                <Statistic 
                  title="总风险数" 
                  value={checkResult.stats.total}
                  prefix={<AlertOutlined />}
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
                  title="需署名素材" 
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
              description={`其中 ${checkResult.stats.critical} 个严重、${checkResult.stats.high} 个高风险，请优先处理。`}
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={16}>
              <Space>
                <Select
                  placeholder="筛选风险等级"
                  allowClear
                  style={{ width: 120 }}
                  value={filterLevel}
                  onChange={setFilterLevel}
                  prefix={<FilterOutlined />}
                >
                  <Option value={RISK_LEVELS.CRITICAL}>严重</Option>
                  <Option value={RISK_LEVELS.HIGH}>高</Option>
                  <Option value={RISK_LEVELS.MEDIUM}>中</Option>
                  <Option value={RISK_LEVELS.LOW}>低</Option>
                </Select>
                <Select
                  placeholder="筛选风险类型"
                  allowClear
                  style={{ width: 150 }}
                  value={filterType}
                  onChange={setFilterType}
                >
                  {Object.entries(RISK_TYPE_LABELS).map(([key, label]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
                <Input
                  placeholder="搜索素材名称或问题描述"
                  prefix={<SearchOutlined />}
                  style={{ width: 250 }}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                />
              </Space>
            </Col>
            <Col span={8} style={{ textAlign: 'right' }}>
              <span style={{ color: '#666' }}>
                共 {filteredRisks.length} 个风险
              </span>
            </Col>
          </Row>

          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane 
              tab={
                <span>
                  全部
                  <Badge count={checkResult.stats.total} style={{ marginLeft: 8 }} />
                </span>
              } 
              key="all" 
            />
            {checkResult.stats.critical > 0 && (
              <TabPane 
                tab={
                  <span style={{ color: '#ff4d4f' }}>
                    严重
                    <Badge count={checkResult.stats.critical} style={{ marginLeft: 8, backgroundColor: '#ff4d4f' }} />
                  </span>
                } 
                key="critical" 
              />
            )}
            {checkResult.stats.high > 0 && (
              <TabPane 
                tab={
                  <span style={{ color: '#ff7a45' }}>
                    高
                    <Badge count={checkResult.stats.high} style={{ marginLeft: 8, backgroundColor: '#ff7a45' }} />
                  </span>
                } 
                key="high" 
              />
            )}
            {checkResult.stats.medium > 0 && (
              <TabPane 
                tab={
                  <span style={{ color: '#faad14' }}>
                    中
                    <Badge count={checkResult.stats.medium} style={{ marginLeft: 8, backgroundColor: '#faad14' }} />
                  </span>
                } 
                key="medium" 
              />
            )}
          </Tabs>

          {filteredRisks.length === 0 ? (
            <Empty description="没有匹配的风险记录" style={{ margin: '40px 0' }} />
          ) : (
            <Table
              columns={riskColumns}
              dataSource={filteredRisks}
              rowKey={(record, index) => `${record.type}-${record.timeline_id}-${index}`}
              expandable={{
                expandedRowRender: expandRowRender,
                defaultExpandAllRows: false,
              }}
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 个风险`,
                pageSize: 10,
              }}
              scroll={{ x: 1000 }}
              rowClassName={(record) => {
                const config = getLevelBadge(record.level)
                return `risk-${record.level}`
              }}
            />
          )}

          {checkResult.attributionList.length > 0 && (
            <Card 
              title={
                <Space>
                  <EditOutlined />
                  <span>待补充署名清单</span>
                  <Badge count={checkResult.attributionList.length} />
                </Space>
              }
              style={{ marginTop: 24 }}
              size="small"
            >
              <List
                dataSource={checkResult.attributionList}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Tag color="purple">需署名</Tag>}
                      title={item.material_name}
                      description={
                        <span style={{ color: '#666' }}>
                          建议署名文本: <strong style={{ color: '#1890ff' }}>{item.attribution_text}</strong>
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}

          {checkResult.grouped.byMaterial.length > 0 && (
            <Card 
              title={
                <Space>
                  <DatabaseOutlined />
                  <span>按素材分组</span>
                </Space>
              }
              style={{ marginTop: 24 }}
              size="small"
            >
              <Collapse defaultActiveKey={[]}>
                {checkResult.grouped.byMaterial.map((group) => {
                  const hasCritical = group.risks.some(r => r.level === RISK_LEVELS.CRITICAL)
                  const hasHigh = group.risks.some(r => r.level === RISK_LEVELS.HIGH)
                  
                  return (
                    <Panel
                      key={group.material_id || group.material_name}
                      header={
                        <Space>
                          <span style={{ fontWeight: 'bold' }}>{group.material_name}</span>
                          <Badge 
                            count={group.risks.length} 
                            style={{ 
                              backgroundColor: hasCritical ? '#ff4d4f' : hasHigh ? '#ff7a45' : '#faad14' 
                            }} 
                          />
                        </Space>
                      }
                    >
                      <List
                        dataSource={group.risks}
                        renderItem={(risk) => (
                          <List.Item>
                            <Space>
                              <Tag color={getLevelBadge(risk.level).color}>
                                {RISK_LEVEL_LABELS[risk.level]}
                              </Tag>
                              <Tag>{RISK_TYPE_LABELS[risk.type]}</Tag>
                              <span>{risk.message}</span>
                            </Space>
                          </List.Item>
                        )}
                      />
                    </Panel>
                  )
                })}
              </Collapse>
            </Card>
          )}

          {checkResult.grouped.byType.length > 0 && (
            <Card 
              title={
                <Space>
                  <AlertOutlined />
                  <span>按风险类型分组</span>
                </Space>
              }
              style={{ marginTop: 24 }}
              size="small"
            >
              <Row gutter={16}>
                {checkResult.grouped.byType.map((group) => {
                  const hasCritical = group.risks.some(r => r.level === RISK_LEVELS.CRITICAL)
                  
                  return (
                    <Col span={6} key={group.type}>
                      <Card 
                        size="small"
                        style={{ 
                          borderLeft: `4px solid ${hasCritical ? '#ff4d4f' : '#faad14'}`,
                          marginBottom: 16 
                        }}
                      >
                        <Statistic
                          title={group.type_label}
                          value={group.risks.length}
                          valueStyle={{ 
                            color: hasCritical ? '#ff4d4f' : '#faad14',
                            fontSize: 24
                          }}
                        />
                      </Card>
                    </Col>
                  )
                })}
              </Row>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

export default RiskCheckPage
