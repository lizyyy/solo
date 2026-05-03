import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Popconfirm,
  message,
  Upload,
  Empty,
  Row,
  Col,
  Card,
  Statistic,
  Tag,
  Tabs,
  InputNumber,
  Divider,
  Radio,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
  ImportOutlined,
  ExportOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import dayjs from 'dayjs'
import { projects as projectsAPI, timelines as timelinesAPI, materials as materialsAPI, exportProject, importProject, dialog } from '../services/api'

const { TextArea } = Input
const { Option } = Select
const { TabPane } = Tabs

const PLATFORMS = ['抖音', '小红书', 'B站', '微信视频号', '微博', '快手', 'YouTube', '其他']

const PROJECT_STATUSES = [
  { value: 'draft', label: '草稿' },
  { value: 'in_progress', label: '制作中' },
  { value: 'review', label: '审核中' },
  { value: 'completed', label: '已完成' },
]

const getStatusTag = (status) => {
  const colors = {
    draft: 'default',
    in_progress: 'processing',
    review: 'warning',
    completed: 'success',
  }
  const labels = {
    draft: '草稿',
    in_progress: '制作中',
    review: '审核中',
    completed: '已完成',
  }
  return <Tag color={colors[status] || 'default'}>{labels[status] || status}</Tag>
}

const formatTime = (seconds) => {
  if (seconds == null) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const ProjectsPage = () => {
  const [projects, setProjects] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [timelines, setTimelines] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  
  const [projectModalVisible, setProjectModalVisible] = useState(false)
  const [timelineModalVisible, setTimelineModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  
  const [editingProject, setEditingProject] = useState(null)
  const [editingTimeline, setEditingTimeline] = useState(null)
  
  const [projectForm] = Form.useForm()
  const [timelineForm] = Form.useForm()
  
  const [importResults, setImportResults] = useState(null)
  const [importFormat, setImportFormat] = useState('json')

  const loadProjects = async () => {
    setLoading(true)
    try {
      const data = await projectsAPI.getAll()
      setProjects(data || [])
    } catch (error) {
      message.error('加载项目列表失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMaterials = async () => {
    try {
      const data = await materialsAPI.getAll()
      setMaterials(data || [])
    } catch (error) {
      console.error('加载素材列表失败:', error)
    }
  }

  const loadTimelines = async (projectId) => {
    if (!projectId) {
      setTimelines([])
      return
    }
    setTimelineLoading(true)
    try {
      const data = await timelinesAPI.getByProject(projectId)
      setTimelines(data || [])
    } catch (error) {
      message.error('加载时间轴失败: ' + error.message)
    } finally {
      setTimelineLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
    loadMaterials()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      loadTimelines(selectedProject.id)
    }
  }, [selectedProject])

  const handleCreateProject = () => {
    setEditingProject(null)
    projectForm.resetFields()
    setProjectModalVisible(true)
  }

  const handleEditProject = (record) => {
    setEditingProject(record)
    projectForm.setFieldsValue({
      ...record,
    })
    setProjectModalVisible(true)
  }

  const handleDeleteProject = async (id) => {
    try {
      await projectsAPI.delete(id)
      message.success('删除成功')
      if (selectedProject?.id === id) {
        setSelectedProject(null)
        setTimelines([])
      }
      loadProjects()
    } catch (error) {
      message.error('删除失败: ' + error.message)
    }
  }

  const handleProjectSubmit = async (values) => {
    try {
      if (editingProject) {
        await projectsAPI.update(editingProject.id, values)
        message.success('更新成功')
      } else {
        await projectsAPI.create(values)
        message.success('创建成功')
      }
      
      setProjectModalVisible(false)
      loadProjects()
    } catch (error) {
      message.error('保存失败: ' + error.message)
    }
  }

  const handleSelectProject = (record) => {
    setSelectedProject(record)
  }

  const handleCreateTimeline = () => {
    setEditingTimeline(null)
    timelineForm.resetFields()
    timelineForm.setFieldsValue({
      project_id: selectedProject.id,
      start_time: 0,
      end_time: 10,
      target_platform: selectedProject?.target_platforms?.[0] || null,
      client_name: selectedProject?.client_name || null,
    })
    setTimelineModalVisible(true)
  }

  const handleEditTimeline = (record) => {
    setEditingTimeline(record)
    timelineForm.setFieldsValue({
      ...record,
    })
    setTimelineModalVisible(true)
  }

  const handleDeleteTimeline = async (id) => {
    try {
      await timelinesAPI.delete(id)
      message.success('删除成功')
      loadTimelines(selectedProject.id)
    } catch (error) {
      message.error('删除失败: ' + error.message)
    }
  }

  const handleTimelineSubmit = async (values) => {
    try {
      const selectedMaterial = materials.find(m => m.id === values.material_id)
      
      const data = {
        ...values,
        material_name: selectedMaterial?.name || values.material_name,
      }
      
      if (editingTimeline) {
        await timelinesAPI.update(editingTimeline.id, data)
        message.success('更新成功')
      } else {
        await timelinesAPI.create(data)
        message.success('创建成功')
      }
      
      setTimelineModalVisible(false)
      loadTimelines(selectedProject.id)
    } catch (error) {
      message.error('保存失败: ' + error.message)
    }
  }

  const handleExportProject = async () => {
    if (!selectedProject) {
      message.warning('请先选择一个项目')
      return
    }
    
    try {
      const result = await dialog.saveFile({
        title: '导出项目',
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
        ],
      })
      
      if (!result.canceled && result.filePath) {
        const exportData = await exportProject(selectedProject.id)
        const fs = window.require ? window.require('fs') : null
        if (!fs) {
          message.error('当前环境不支持文件导出')
          return
        }
        
        const content = JSON.stringify(exportData, null, 2)
        fs.writeFileSync(result.filePath, content)
        message.success('导出成功: ' + result.filePath)
      }
    } catch (error) {
      message.error('导出失败: ' + error.message)
    }
  }

  const handleProjectImport = (file) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const content = e.target.result
      
      try {
        let parsedData
        
        if (importFormat === 'csv') {
          const result = Papa.parse(content, { header: true })
          if (result.errors.length > 0) {
            message.error('CSV 解析错误: ' + result.errors[0].message)
            return
          }
          parsedData = {
            project: {
              name: '导入项目',
              status: 'draft',
            },
            timelines: result.data.filter(row => row.material_name || row.material_id),
          }
        } else {
          parsedData = JSON.parse(content)
        }
        
        const result = await importProject(parsedData)
        
        if (result.success) {
          message.success('项目导入成功')
          loadProjects()
          setImportModalVisible(false)
        } else {
          message.error('导入失败: ' + (result.errors?.[0] || '未知错误'))
        }
      } catch (error) {
        message.error('解析文件失败: ' + error.message)
      }
    }
    reader.readAsText(file)
    return false
  }

  const projectColumns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
      render: (name, record) => (
        <a onClick={() => handleSelectProject(record)} style={{ fontWeight: selectedProject?.id === record.id ? 'bold' : 'normal' }}>
          {name}
        </a>
      ),
    },
    {
      title: '客户',
      dataIndex: 'client_name',
      key: 'client_name',
      width: 150,
      render: (v) => v || '-',
    },
    {
      title: '目标平台',
      dataIndex: 'target_platforms',
      key: 'target_platforms',
      width: 200,
      render: (platforms) => (
        <Space wrap size={[0, 4]}>
          {platforms?.map(p => <Tag key={p} size="small">{p}</Tag>) || '-'}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: getStatusTag,
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditProject(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此项目？将同时删除所有时间轴片段。"
            onConfirm={() => handleDeleteProject(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const timelineColumns = [
    {
      title: '时间',
      key: 'time',
      width: 120,
      render: (_, record) => (
        <span>
          {formatTime(record.start_time)} - {formatTime(record.end_time)}
        </span>
      ),
    },
    {
      title: '素材',
      dataIndex: 'material_name',
      key: 'material_name',
      width: 180,
      ellipsis: true,
      render: (name, record) => (
        <Space>
          <span>{name || '未命名'}</span>
          {!record.material_id && <Tag color="warning">未关联素材库</Tag>}
        </Space>
      ),
    },
    {
      title: '用途',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 120,
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '目标平台',
      dataIndex: 'target_platform',
      key: 'target_platform',
      width: 100,
      render: (v) => v || '-',
    },
    {
      title: '客户',
      dataIndex: 'client_name',
      key: 'client_name',
      width: 120,
      render: (v) => v || '-',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 150,
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditTimeline(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此片段？"
            onConfirm={() => handleDeleteTimeline(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const stats = {
    total: projects.length,
    draft: projects.filter(p => p.status === 'draft').length,
    inProgress: projects.filter(p => p.status === 'in_progress').length,
    review: projects.filter(p => p.status === 'review').length,
    completed: projects.filter(p => p.status === 'completed').length,
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic title="总项目数" value={stats.total} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="草稿" value={stats.draft} valueStyle={{ color: '#999' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="制作中" value={stats.inProgress} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="审核中" value={stats.review} valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic 
                title="时间轴片段" 
                value={selectedProject ? timelines.length : '-'} 
                valueStyle={{ color: selectedProject ? '#722ed1' : '#999' }} 
              />
            </Card>
          </Col>
        </Row>

        <Row justify="space-between" align="middle">
          <Col>
            <h2 style={{ margin: 0 }}>成片/项目管理</h2>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadProjects}>
                刷新
              </Button>
              <Button icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
                导入项目
              </Button>
              {selectedProject && (
                <Button icon={<ExportOutlined />} onClick={handleExportProject}>
                  导出项目
                </Button>
              )}
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateProject}>
                新建项目
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Row gutter={24}>
        <Col span={selectedProject ? 10 : 24}>
          <Card 
            title="项目列表" 
            size="small"
            extra={selectedProject && (
              <Button type="link" size="small" onClick={() => setSelectedProject(null)}>
                取消选择
              </Button>
            )}
          >
            {projects.length === 0 ? (
              <Empty
                description={
                  <div>
                    <p className="empty-state-text">暂无项目</p>
                    <p style={{ marginTop: 8 }}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateProject}>
                        创建第一个项目
                      </Button>
                      <span style={{ margin: '0 12px', color: '#999' }}>或</span>
                      <Button icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
                        从文件导入
                      </Button>
                    </p>
                  </div>
                }
              />
            ) : (
              <Table
                columns={projectColumns}
                dataSource={projects}
                rowKey="id"
                loading={loading}
                scroll={{ x: 800 }}
                pagination={{
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 个项目`,
                  pageSize: 5,
                }}
                rowClassName={(record) => 
                  selectedProject?.id === record.id ? 'ant-table-row-selected' : ''
                }
              />
            )}
          </Card>
        </Col>

        {selectedProject && (
          <Col span={14}>
            <Card
              title={
                <Space>
                  <VideoCameraOutlined />
                  <span>{selectedProject.name}</span>
                  {getStatusTag(selectedProject.status)}
                </Space>
              }
              size="small"
              extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTimeline}>
                  添加片段
                </Button>
              }
            >
              <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <Row gutter={16}>
                  <Col span={6}>
                    <strong>客户:</strong> {selectedProject.client_name || '-'}
                  </Col>
                  <Col span={12}>
                    <strong>目标平台:</strong> {selectedProject.target_platforms?.join('、') || '-'}
                  </Col>
                  <Col span={6}>
                    <strong>片段数:</strong> {timelines.length}
                  </Col>
                </Row>
                {selectedProject.description && (
                  <Row style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <strong>描述:</strong> {selectedProject.description}
                    </Col>
                  </Row>
                )}
              </div>

              {timelines.length === 0 ? (
                <Empty
                  description={
                    <div>
                      <p className="empty-state-text">暂无时间轴片段</p>
                      <p style={{ marginTop: 8 }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTimeline}>
                          添加第一个片段
                        </Button>
                      </p>
                    </div>
                  }
                />
              ) : (
                <Table
                  columns={timelineColumns}
                  dataSource={timelines}
                  rowKey="id"
                  loading={timelineLoading}
                  scroll={{ x: 900 }}
                  pagination={{
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 个片段`,
                    pageSize: 10,
                  }}
                  className="timeline-table"
                />
              )}
            </Card>
          </Col>
        )}
      </Row>

      <Modal
        title={editingProject ? '编辑项目' : '新建项目'}
        open={projectModalVisible}
        onCancel={() => setProjectModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={projectForm}
          layout="vertical"
          onFinish={handleProjectSubmit}
          initialValues={{
            status: 'draft',
          }}
        >
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="name"
                label="项目名称"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
                <Input placeholder="例如：某品牌 618 推广短视频" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select>
                  {PROJECT_STATUSES.map(s => (
                    <Option key={s.value} value={s.value}>{s.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="client_name" label="客户名称">
                <Input placeholder="例如：某品牌客户" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="target_platforms" label="目标平台">
                <Select
                  mode="multiple"
                  placeholder="选择目标发布平台"
                  allowClear
                >
                  {PLATFORMS.map(p => (
                    <Option key={p} value={p}>{p}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="项目描述">
            <TextArea rows={3} placeholder="项目简介、需求说明等" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setProjectModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingProject ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingTimeline ? '编辑时间轴片段' : '添加时间轴片段'}
        open={timelineModalVisible}
        onCancel={() => setTimelineModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={timelineForm}
          layout="vertical"
          onFinish={handleTimelineSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="material_id"
                label="关联素材库（可选）"
              >
                <Select
                  placeholder="选择素材库中的素材（可选）"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {materials.map(m => (
                    <Option key={m.id} value={m.id}>
                      {m.name} ({m.type === 'audio' ? '音频' : m.type === 'video' ? '视频' : m.type === 'image' ? '图片' : '字体'})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="material_name"
                label="素材名称"
                rules={[{ required: true, message: '请输入素材名称' }]}
              >
                <Input placeholder="例如：欢快背景音乐 A" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="start_time"
                label="开始时间（秒）"
                rules={[{ required: true, message: '请输入开始时间' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="end_time"
                label="结束时间（秒）"
                rules={[{ required: true, message: '请输入结束时间' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="10" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="purpose" label="用途">
                <Input placeholder="例如：开场镜头、全程背景音乐" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="target_platform" label="目标平台">
                <Select placeholder="此片段的目标发布平台" allowClear>
                  {PLATFORMS.map(p => (
                    <Option key={p} value={p}>{p}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="client_name" label="客户">
                <Input placeholder="此片段对应的客户（如有限制）" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="备注">
            <TextArea rows={2} placeholder="其他备注信息" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setTimelineModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingTimeline ? '保存' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入项目"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false)
          setImportResults(null)
        }}
        footer={null}
      >
        <Form layout="vertical">
          <Form.Item label="导入格式">
            <Radio.Group value={importFormat} onChange={e => setImportFormat(e.target.value)}>
              <Radio value="json">JSON 文件（推荐）</Radio>
              <Radio value="csv">CSV 文件</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="选择文件">
            <Upload.Dragger
              accept={importFormat === 'csv' ? '.csv' : '.json'}
              beforeUpload={handleProjectImport}
              maxCount={1}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 {importFormat.toUpperCase()} 格式
              </p>
            </Upload.Dragger>
          </Form.Item>

          {importResults && (
            <div style={{ marginTop: 16 }}>
              {importResults.success && (
                <div className="import-success">
                  ✅ 导入成功
                </div>
              )}
              {importResults.errors?.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: 8, color: '#ff4d4f' }}>
                    导入失败:
                  </h4>
                  {importResults.errors.map((err, idx) => (
                    <div key={idx} className="import-error">
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 24, padding: 16, background: '#fafafa', borderRadius: 4 }}>
            <h4 style={{ marginBottom: 8 }}>JSON 格式说明：</h4>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              导出的项目文件包含：project（项目信息）、timelines（时间轴片段）、materials（关联素材）
            </p>
            <Divider style={{ margin: '12px 0' }} />
            <h4 style={{ marginBottom: 8 }}>CSV 格式说明：</h4>
            <p style={{ fontSize: 12, color: '#666' }}>
              必填字段：material_name（素材名称）<br/>
              可选字段：start_time, end_time, purpose, target_platform, client_name, notes
            </p>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default ProjectsPage
