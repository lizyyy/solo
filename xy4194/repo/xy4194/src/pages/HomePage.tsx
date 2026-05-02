import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Button, Empty, List, Tag, Typography } from 'antd'
import {
  ImportOutlined,
  TimelineOutlined,
  WarningOutlined,
  ExportOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  UserOutlined,
  PictureOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { Project, Scene, PropStatus, ActorCall, PhotoInfo, ValidationIssue, Review } from '../types'

const { Title, Text } = Typography

interface HomePageProps {
  appState: {
    currentProject: Project | null
    scenes: Scene[]
    propStatus: PropStatus[]
    actorCalls: ActorCall[]
    photos: PhotoInfo[]
    issues: ValidationIssue[]
    reviews: Review[]
  }
  onNavigate: (key: string) => void
}

function HomePage({ appState, onNavigate }: HomePageProps) {
  const { currentProject, scenes, propStatus, actorCalls, photos, issues, reviews } = appState

  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const warningCount = issues.filter(i => i.severity === 'warning').length
  const infoCount = issues.filter(i => i.severity === 'info').length

  const hasData = scenes.length > 0

  if (!hasData) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Title level={4}>欢迎使用连续性穿帮核对台</Title>
              <Text type="secondary">
                这是一个专为剧组场记设计的桌面应用，帮助你检测和管理拍摄中的连续性问题。
              </Text>
            </div>
          }
        >
          <Button
            type="primary"
            icon={<ImportOutlined />}
            size="large"
            onClick={() => onNavigate('import')}
          >
            导入数据开始使用
          </Button>
        </Empty>

        <div style={{ marginTop: '60px' }}>
          <Title level={4}>功能介绍</Title>
          <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable onClick={() => onNavigate('import')}>
                <Statistic
                  title="导入数据"
                  value="CSV/JSON"
                  prefix={<ImportOutlined />}
                />
                <p style={{ marginTop: '12px', color: '#666', fontSize: '13px' }}>
                  导入场次表、道具状态、演员通告和照片目录
                </p>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable onClick={() => onNavigate('timeline')}>
                <Statistic
                  title="连续性时间线"
                  value="按剧情排序"
                  prefix={<TimelineOutlined />}
                />
                <p style={{ marginTop: '12px', color: '#666', fontSize: '13px' }}>
                  按角色和场次展示连续性时间线
                </p>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable onClick={() => onNavigate('issues')}>
                <Statistic
                  title="问题检测"
                  value="自动分析"
                  prefix={<WarningOutlined />}
                />
                <p style={{ marginTop: '12px', color: '#666', fontSize: '13px' }}>
                  自动检测道具跳变、服装缺失、日期冲突等问题
                </p>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable onClick={() => onNavigate('export')}>
                <Statistic
                  title="导出报告"
                  value="多种格式"
                  prefix={<ExportOutlined />}
                />
                <p style={{ marginTop: '12px', color: '#666', fontSize: '13px' }}>
                  导出Markdown复盘单、CSV问题表、JSON审计包
                </p>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Title level={3}>项目概览</Title>
      {currentProject && (
        <Card style={{ marginBottom: '24px' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Text strong>项目名称：</Text>
              <Text>{currentProject.name}</Text>
            </Col>
            <Col span={12}>
              <Text strong>创建时间：</Text>
              <Text>{currentProject.createdAt}</Text>
            </Col>
            {currentProject.description && (
              <Col span={24} style={{ marginTop: '8px' }}>
                <Text strong>描述：</Text>
                <Text>{currentProject.description}</Text>
              </Col>
            )}
          </Row>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="场景数量"
              value={scenes.length}
              prefix={<VideoCameraOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="道具/服装记录"
              value={propStatus.length}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="演员通告"
              value={actorCalls.length}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="照片数量"
              value={photos.length}
              prefix={<PictureOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {issues.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <Title level={4}>问题统计</Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="严重问题"
                  value={criticalCount}
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<ExclamationCircleOutlined />}
                  suffix={
                    <Button
                      type="link"
                      size="small"
                      onClick={() => onNavigate('issues')}
                    >
                      查看详情
                    </Button>
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="警告"
                  value={warningCount}
                  valueStyle={{ color: '#faad14' }}
                  prefix={<WarningOutlined />}
                  suffix={
                    <Button
                      type="link"
                      size="small"
                      onClick={() => onNavigate('issues')}
                    >
                      查看详情
                    </Button>
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="信息"
                  value={infoCount}
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<InfoCircleOutlined />}
                  suffix={
                    <Button
                      type="link"
                      size="small"
                      onClick={() => onNavigate('issues')}
                    >
                      查看详情
                    </Button>
                  }
                />
              </Card>
            </Col>
          </Row>
        </div>
      )}

      <div style={{ marginTop: '24px' }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <Card
              title="快速操作"
              extra={
                <Button type="primary" onClick={() => onNavigate('import')}>
                  重新导入
                </Button>
              }
            >
              <List
                dataSource={[
                  {
                    key: 'timeline',
                    icon: <TimelineOutlined />,
                    title: '查看连续性时间线',
                    action: () => onNavigate('timeline'),
                  },
                  {
                    key: 'issues',
                    icon: <WarningOutlined />,
                    title: '查看检测到的问题',
                    action: () => onNavigate('issues'),
                  },
                  {
                    key: 'export',
                    icon: <ExportOutlined />,
                    title: '导出报告',
                    action: () => onNavigate('export'),
                  },
                ]}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button type="link" onClick={item.action}>
                        前往
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={item.icon}
                      title={item.title}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="最近场景">
              <List
                dataSource={scenes.slice(0, 5)}
                renderItem={(scene, index) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Tag color="blue">{scene.sceneNumber}</Tag>}
                      title={scene.sceneName}
                      description={
                        <span>
                          拍摄日期: {scene.shootDate} | 剧情顺序: {scene.storyOrder}
                          {scene.actors.length > 0 && (
                            <span> | 演员: {scene.actors.slice(0, 2).join(', ')}</span>
                          )}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  )
}

export default HomePage
