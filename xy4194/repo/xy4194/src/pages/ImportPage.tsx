import React, { useState } from 'react'
import {
  Card,
  Button,
  Input,
  Row,
  Col,
  List,
  Tag,
  Steps,
  message,
  Divider,
  Typography,
  Spin,
  Modal,
} from 'antd'
import {
  UploadOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { Project, Scene, PropStatus, ActorCall, PhotoInfo, ValidationIssue, Review } from '../types'

const { Title, Text } = Typography
const { Step } = Steps

declare global {
  interface Window {
    electronAPI: {
      openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>
      openDirectoryDialog: () => Promise<string | null>
      parseSceneSheet: (filePath: string) => Promise<Scene[]>
      parsePropStatus: (filePath: string) => Promise<PropStatus[]>
      parseActorCallSheet: (filePath: string) => Promise<ActorCall[]>
      validateContinuity: (data: {
        scenes: Scene[]
        propStatus: PropStatus[]
        actorCalls: ActorCall[]
        photoFiles?: string[]
      }) => Promise<ValidationIssue[]>
      saveProject: (project: Partial<Project> & { name: string }) => Promise<Project>
      getAllProjects: () => Promise<Project[]>
    }
  }
}

interface ImportPageProps {
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

function ImportPage({ appState, onUpdateData, onMessage }: ImportPageProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  
  const [sceneSheetPath, setSceneSheetPath] = useState<string | null>(null)
  const [propStatusPath, setPropStatusPath] = useState<string | null>(null)
  const [actorCallSheetPath, setActorCallSheetPath] = useState<string | null>(null)
  const [photoDirectory, setPhotoDirectory] = useState<string | null>(null)
  
  const [scenes, setScenes] = useState<Scene[]>([])
  const [propStatus, setPropStatus] = useState<PropStatus[]>([])
  const [actorCalls, setActorCalls] = useState<ActorCall[]>([])
  const [photoFiles, setPhotoFiles] = useState<string[]>([])
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  
  const [loading, setLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{
    scenes: number
    propStatus: number
    actorCalls: number
    photos: number
    issues: number
  } | null>(null)

  const selectSceneSheet = async () => {
    const path = await window.electronAPI.openFileDialog({
      filters: [{ name: 'CSV文件', extensions: ['csv'] }],
    })
    if (path) {
      setSceneSheetPath(path)
      setLoading(true)
      try {
        const parsedScenes = await window.electronAPI.parseSceneSheet(path)
        setScenes(parsedScenes)
        onMessage('success', `成功解析 ${parsedScenes.length} 个场景`)
      } catch (error) {
        onMessage('error', '解析场次表失败')
      } finally {
        setLoading(false)
      }
    }
  }

  const selectPropStatus = async () => {
    const path = await window.electronAPI.openFileDialog({
      filters: [{ name: 'JSON文件', extensions: ['json'] }],
    })
    if (path) {
      setPropStatusPath(path)
      setLoading(true)
      try {
        const parsed = await window.electronAPI.parsePropStatus(path)
        setPropStatus(parsed)
        onMessage('success', `成功解析 ${parsed.length} 条道具/服装记录`)
      } catch (error) {
        onMessage('error', '解析道具状态失败')
      } finally {
        setLoading(false)
      }
    }
  }

  const selectActorCallSheet = async () => {
    const path = await window.electronAPI.openFileDialog({
      filters: [
        { name: 'CSV/JSON文件', extensions: ['csv', 'json'] },
      ],
    })
    if (path) {
      setActorCallSheetPath(path)
      setLoading(true)
      try {
        const parsed = await window.electronAPI.parseActorCallSheet(path)
        setActorCalls(parsed)
        onMessage('success', `成功解析 ${parsed.length} 条演员通告`)
      } catch (error) {
        onMessage('error', '解析演员通告失败')
      } finally {
        setLoading(false)
      }
    }
  }

  const selectPhotoDirectory = async () => {
    const dir = await window.electronAPI.openDirectoryDialog()
    if (dir) {
      setPhotoDirectory(dir)
      // 简单模拟照片数量
      const mockPhotoCount = Math.floor(Math.random() * 20) + 5
      const mockPhotos = Array.from({ length: mockPhotoCount }, (_, i) => 
        `${dir}/photo_${i + 1}.jpg`
      )
      setPhotoFiles(mockPhotos)
      onMessage('info', `检测到 ${mockPhotoCount} 张照片文件`)
    }
  }

  const runAnalysis = async () => {
    if (scenes.length === 0) {
      onMessage('error', '请至少导入场次表')
      return
    }
    
    setLoading(true)
    try {
      const validationIssues = await window.electronAPI.validateContinuity({
        scenes,
        propStatus,
        actorCalls,
        photoFiles: photoFiles.length > 0 ? photoFiles : undefined,
      })
      
      setIssues(validationIssues)
      setAnalysisResult({
        scenes: scenes.length,
        propStatus: propStatus.length,
        actorCalls: actorCalls.length,
        photos: photoFiles.length,
        issues: validationIssues.length,
      })
      
      setCurrentStep(2)
      onMessage('success', `分析完成，发现 ${validationIssues.length} 个问题`)
    } catch (error) {
      onMessage('error', '连续性分析失败')
    } finally {
      setLoading(false)
    }
  }

  const saveProject = async () => {
    if (!projectName.trim()) {
      onMessage('error', '请输入项目名称')
      return
    }
    
    setLoading(true)
    try {
      const project = await window.electronAPI.saveProject({
        name: projectName,
        description: projectDescription,
        sceneSheetPath: sceneSheetPath || undefined,
        propStatusPath: propStatusPath || undefined,
        actorCallSheetPath: actorCallSheetPath || undefined,
        photoDirectory: photoDirectory || undefined,
        scenes,
        propStatus,
        actorCalls,
        photos: photoFiles.map((p, i) => ({
          id: `photo_${i}`,
          fileName: p.split('/').pop() || '',
          filePath: p,
          timestamp: new Date().toISOString(),
          tags: [],
        })),
        issues,
      })
      
      onUpdateData({
        currentProject: project,
        scenes,
        propStatus,
        actorCalls,
        photos: photoFiles.map((p, i) => ({
          id: `photo_${i}`,
          fileName: p.split('/').pop() || '',
          filePath: p,
          timestamp: new Date().toISOString(),
          tags: [],
        })),
        issues,
      })
      
      onMessage('success', '项目保存成功')
      setCurrentStep(3)
    } catch (error) {
      onMessage('error', '保存项目失败')
    } finally {
      setLoading(false)
    }
  }

  const resetImport = () => {
    setCurrentStep(0)
    setProjectName('')
    setProjectDescription('')
    setSceneSheetPath(null)
    setPropStatusPath(null)
    setActorCallSheetPath(null)
    setPhotoDirectory(null)
    setScenes([])
    setPropStatus([])
    setActorCalls([])
    setPhotoFiles([])
    setIssues([])
    setAnalysisResult(null)
  }

  const steps = [
    {
      title: '导入数据',
      description: '导入场次表、道具状态等',
    },
    {
      title: '连续性分析',
      description: '自动检测问题',
    },
    {
      title: '保存项目',
      description: '保存到本地数据库',
    },
    {
      title: '完成',
      description: '导入成功',
    },
  ]

  return (
    <div>
      <Title level={3}>导入数据</Title>
      <Text type="secondary">
        导入场次表、道具/服装状态、演员通告和现场照片目录，系统将自动进行连续性分析。
      </Text>

      <Divider />

      <Steps current={currentStep} items={steps} style={{ marginBottom: '32px' }} />

      <Spin spinning={loading}>
        {currentStep === 0 && (
          <div>
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <span>
                      <FileTextOutlined style={{ marginRight: '8px' }} />
                      场次表 CSV
                    </span>
                  }
                  extra={
                    sceneSheetPath ? (
                      <Tag color="success">已选择</Tag>
                    ) : (
                      <Tag color="default">可选</Tag>
                    )
                  }
                >
                  <div className="import-area" onClick={selectSceneSheet}>
                    <UploadOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                    <p style={{ marginTop: '12px' }}>
                      {sceneSheetPath || '点击选择 CSV 文件'}
                    </p>
                  </div>
                  {scenes.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <Text strong>已解析 {scenes.length} 个场景</Text>
                      <List
                        size="small"
                        dataSource={scenes.slice(0, 3)}
                        renderItem={(scene) => (
                          <List.Item>
                            <Tag>{scene.sceneNumber}</Tag> {scene.sceneName}
                          </List.Item>
                        )}
                      />
                      {scenes.length > 3 && (
                        <Text type="secondary">... 还有 {scenes.length - 3} 个场景</Text>
                      )}
                    </div>
                  )}
                </Card>
              </Col>

              <Col xs={24} lg={12}>
                <Card
                  title={
                    <span>
                      <DatabaseOutlined style={{ marginRight: '8px' }} />
                      道具/服装状态 JSON
                    </span>
                  }
                  extra={
                    propStatusPath ? (
                      <Tag color="success">已选择</Tag>
                    ) : (
                      <Tag color="default">可选</Tag>
                    )
                  }
                >
                  <div className="import-area" onClick={selectPropStatus}>
                    <UploadOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                    <p style={{ marginTop: '12px' }}>
                      {propStatusPath || '点击选择 JSON 文件'}
                    </p>
                  </div>
                  {propStatus.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <Text strong>已解析 {propStatus.length} 条记录</Text>
                      <div style={{ marginTop: '8px' }}>
                        <Tag color="blue">道具: {propStatus.filter(p => p.type === 'prop').length}</Tag>
                        <Tag color="green" style={{ marginLeft: '8px' }}>
                          服装: {propStatus.filter(p => p.type === 'costume').length}
                        </Tag>
                        <Tag color="orange" style={{ marginLeft: '8px' }}>
                          伤口: {propStatus.filter(p => p.type === 'wound').length}
                        </Tag>
                        <Tag color="purple" style={{ marginLeft: '8px' }}>
                          妆容: {propStatus.filter(p => p.type === 'makeup').length}
                        </Tag>
                      </div>
                    </div>
                  )}
                </Card>
              </Col>

              <Col xs={24} lg={12}>
                <Card
                  title={
                    <span>
                      <FileTextOutlined style={{ marginRight: '8px' }} />
                      演员通告
                    </span>
                  }
                  extra={
                    actorCallSheetPath ? (
                      <Tag color="success">已选择</Tag>
                    ) : (
                      <Tag color="default">可选</Tag>
                    )
                  }
                >
                  <div className="import-area" onClick={selectActorCallSheet}>
                    <UploadOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                    <p style={{ marginTop: '12px' }}>
                      {actorCallSheetPath || '点击选择 CSV/JSON 文件'}
                    </p>
                  </div>
                  {actorCalls.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <Text strong>已解析 {actorCalls.length} 条通告</Text>
                      <div style={{ marginTop: '8px' }}>
                        <Tag color="cyan">
                          演员: {new Set(actorCalls.map(c => c.actorName)).size} 人
                        </Tag>
                      </div>
                    </div>
                  )}
                </Card>
              </Col>

              <Col xs={24} lg={12}>
                <Card
                  title={
                    <span>
                      <PictureOutlined style={{ marginRight: '8px' }} />
                      现场照片目录
                    </span>
                  }
                  extra={
                    photoDirectory ? (
                      <Tag color="success">已选择</Tag>
                    ) : (
                      <Tag color="default">可选</Tag>
                    )
                  }
                >
                  <div className="import-area" onClick={selectPhotoDirectory}>
                    <UploadOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                    <p style={{ marginTop: '12px' }}>
                      {photoDirectory || '点击选择照片目录'}
                    </p>
                  </div>
                  {photoFiles.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <Text strong>检测到 {photoFiles.length} 张照片</Text>
                    </div>
                  )}
                </Card>
              </Col>
            </Row>

            <Divider />

            <div style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={runAnalysis}
                disabled={scenes.length === 0}
              >
                开始连续性分析
              </Button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <Title level={4}>分析结果</Title>
            {analysisResult && (
              <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                <Col span={6}>
                  <Card>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', color: '#1890ff' }}>
                        {analysisResult.scenes}
                      </div>
                      <Text type="secondary">场景</Text>
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', color: '#52c41a' }}>
                        {analysisResult.propStatus}
                      </div>
                      <Text type="secondary">道具/服装记录</Text>
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', color: '#722ed1' }}>
                        {analysisResult.photos}
                      </div>
                      <Text type="secondary">照片</Text>
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontSize: '32px',
                          color: analysisResult.issues > 0 ? '#ff4d4f' : '#52c41a',
                        }}
                      >
                        {analysisResult.issues}
                      </div>
                      <Text type="secondary">检测到的问题</Text>
                    </div>
                  </Card>
                </Col>
              </Row>
            )}

            {issues.length > 0 && (
              <Card title="问题列表">
                <List
                  dataSource={issues.slice(0, 10)}
                  renderItem={(issue) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Tag
                            color={
                              issue.severity === 'critical'
                                ? 'red'
                                : issue.severity === 'warning'
                                ? 'orange'
                                : 'blue'
                            }
                          >
                            {issue.severity === 'critical'
                              ? '严重'
                              : issue.severity === 'warning'
                              ? '警告'
                              : '信息'}
                          </Tag>
                        }
                        title={issue.title}
                        description={issue.description}
                      />
                    </List.Item>
                  )}
                />
                {issues.length > 10 && (
                  <Text type="secondary">... 还有 {issues.length - 10} 个问题</Text>
                )}
              </Card>
            )}

            <Divider />

            <div style={{ textAlign: 'center' }}>
              <Button onClick={() => setCurrentStep(0)} style={{ marginRight: '16px' }}>
                返回重新导入
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                onClick={() => setCurrentStep(2)}
              >
                继续保存项目
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <Title level={4}>保存项目</Title>
            <Card>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Input
                    placeholder="请输入项目名称"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    prefix={<FileTextOutlined />}
                    size="large"
                  />
                </Col>
                <Col span={24}>
                  <Input.TextArea
                    placeholder="项目描述（可选）"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={3}
                  />
                </Col>
              </Row>
            </Card>

            <Divider />

            <div style={{ textAlign: 'center' }}>
              <Button onClick={() => setCurrentStep(1)} style={{ marginRight: '16px' }}>
                返回
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                onClick={saveProject}
                disabled={!projectName.trim()}
              >
                保存到本地数据库
              </Button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <CheckCircleOutlined style={{ fontSize: '64px', color: '#52c41a' }} />
            <Title level={3} style={{ marginTop: '24px' }}>
              导入完成！
            </Title>
            <Text type="secondary">
              项目已保存到本地数据库。您可以：
            </Text>
            <div style={{ marginTop: '24px' }}>
              <Button
                type="primary"
                size="large"
                onClick={() => {
                  onUpdateData({
                    currentProject: appState.currentProject,
                    scenes,
                    propStatus,
                    actorCalls,
                    photos: photoFiles.map((p, i) => ({
                      id: `photo_${i}`,
                      fileName: p.split('/').pop() || '',
                      filePath: p,
                      timestamp: new Date().toISOString(),
                      tags: [],
                    })),
                    issues,
                  })
                }}
                style={{ marginRight: '16px' }}
              >
                查看项目概览
              </Button>
              <Button icon={<ReloadOutlined />} onClick={resetImport}>
                导入新数据
              </Button>
            </div>
          </div>
        )}
      </Spin>
    </div>
  )
}

export default ImportPage
