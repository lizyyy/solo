import React, { useState } from 'react'
import {
  Card,
  Empty,
  Select,
  Row,
  Col,
  Timeline,
  Tag,
  Typography,
  List,
  Divider,
  Tabs,
  Badge,
} from 'antd'
import {
  UserOutlined,
  VideoCameraOutlined,
  TagOutlined,
  ClockCircleOutlined,
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
const { TabPane } = Tabs

declare global {
  interface Window {
    electronAPI: {
      getReviewByIssueId: (issueId: string) => Promise<Review | null>
      saveReview: (review: any) => Promise<Review>
    }
  }
}

interface TimelinePageProps {
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

function TimelinePage({ appState, onMessage }: TimelinePageProps) {
  const { scenes, propStatus, actorCalls, issues } = appState
  const [selectedActor, setSelectedActor] = useState<string>('all')
  const [selectedProp, setSelectedProp] = useState<string>('all')

  const hasData = scenes.length > 0

  // 获取所有演员
  const allActors = Array.from(
    new Set([
      ...scenes.flatMap((s) => s.actors),
      ...propStatus.filter((p) => p.actorName).map((p) => p.actorName!),
      ...actorCalls.map((a) => a.actorName),
    ])
  ).filter(Boolean)

  // 获取所有道具/服装
  const allProps = Array.from(new Set(propStatus.map((p) => p.name))).filter(Boolean)

  // 按剧情顺序排序场景
  const sortedScenes = [...scenes].sort((a, b) => a.storyOrder - b.storyOrder)

  // 获取场景相关的问题
  const getIssuesForScene = (sceneNumber: string) => {
    return issues.filter((i) => i.affectedScenes.includes(sceneNumber))
  }

  // 获取场景相关的道具/服装记录
  const getPropStatusForScene = (sceneNumber: string) => {
    return propStatus.filter((p) => p.sceneNumber === sceneNumber)
  }

  // 获取场景相关的演员通告
  const getActorCallsForScene = (sceneNumber: string) => {
    return actorCalls.filter((c) => c.sceneNumber === sceneNumber)
  }

  if (!hasData) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Title level={4}>暂无数据</Title>
              <Text type="secondary">请先导入场次表等数据</Text>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <Title level={3}>连续性时间线</Title>
      <Text type="secondary">
        按角色和场次展示连续性时间线，帮助你发现可能的连续性问题。
      </Text>

      <Divider />

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12}>
          <Card size="small" title={<span><UserOutlined style={{ marginRight: '8px' }} />按演员筛选</span>}>
            <Select
              style={{ width: '100%' }}
              value={selectedActor}
              onChange={setSelectedActor}
              allowClear
              placeholder="选择演员查看其时间线"
            >
              <Option value="all">全部演员</Option>
              {allActors.map((actor) => (
                <Option key={actor} value={actor}>
                  {actor}
                </Option>
              ))}
            </Select>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card size="small" title={<span><TagOutlined style={{ marginRight: '8px' }} />按道具筛选</span>}>
            <Select
              style={{ width: '100%' }}
              value={selectedProp}
              onChange={setSelectedProp}
              allowClear
              placeholder="选择道具查看其状态变化"
            >
              <Option value="all">全部道具</Option>
              {allProps.map((prop) => (
                <Option key={prop} value={prop}>
                  {prop}
                </Option>
              ))}
            </Select>
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="scenes">
        <TabPane
          tab={
            <span>
              <VideoCameraOutlined />
              场景时间线 ({scenes.length})
            </span>
          }
          key="scenes"
        >
          <Card>
            <Timeline
              mode="alternate"
              items={sortedScenes.map((scene, index) => {
                const sceneIssues = getIssuesForScene(scene.sceneNumber)
                const sceneProps = getPropStatusForScene(scene.sceneNumber)
                const sceneCalls = getActorCallsForScene(scene.sceneNumber)

                const hasIssues = sceneIssues.length > 0
                const criticalCount = sceneIssues.filter((i) => i.severity === 'critical').length
                const warningCount = sceneIssues.filter((i) => i.severity === 'warning').length

                // 检查筛选条件
                const matchesActor =
                  selectedActor === 'all' ||
                  scene.actors.includes(selectedActor) ||
                  sceneProps.some((p) => p.actorName === selectedActor) ||
                  sceneCalls.some((c) => c.actorName === selectedActor)

                const matchesProp =
                  selectedProp === 'all' ||
                  scene.props.includes(selectedProp) ||
                  sceneProps.some((p) => p.name === selectedProp)

                if (!matchesActor && !matchesProp) {
                  return null
                }

                return {
                  color: hasIssues ? (criticalCount > 0 ? 'red' : 'orange') : 'blue',
                  dot: hasIssues ? (
                    <Badge
                      count={sceneIssues.length}
                      style={{ backgroundColor: criticalCount > 0 ? '#ff4d4f' : '#faad14' }}
                    />
                  ) : (
                    <ClockCircleOutlined />
                  ),
                  children: (
                    <Card size="small" style={{ marginBottom: '16px' }}>
                      <div>
                        <Title level={5}>
                          <Tag color="blue">{scene.sceneNumber}</Tag> {scene.sceneName}
                        </Title>
                        <div style={{ marginBottom: '12px' }}>
                          <Text type="secondary">
                            拍摄日期: {scene.shootDate} | 剧情顺序: {scene.storyOrder} | 拍摄顺序: {scene.shootOrder}
                          </Text>
                          <br />
                          <Text type="secondary">
                            {scene.interiorExterior} | {scene.location} | {scene.dayNight}
                          </Text>
                        </div>

                        {scene.actors.length > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <Text strong>演员: </Text>
                            {scene.actors.map((actor) => (
                              <Tag key={actor} color="cyan" style={{ marginBottom: '4px' }}>
                                {actor}
                              </Tag>
                            ))}
                          </div>
                        )}

                        {sceneProps.length > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <Text strong>道具/服装状态: </Text>
                            <List
                              size="small"
                              dataSource={sceneProps}
                              renderItem={(prop) => (
                                <List.Item>
                                  <Tag
                                    color={
                                      prop.type === 'costume'
                                        ? 'green'
                                        : prop.type === 'wound'
                                        ? 'orange'
                                        : prop.type === 'makeup'
                                        ? 'purple'
                                        : 'blue'
                                    }
                                  >
                                    {prop.type === 'costume'
                                      ? '服装'
                                      : prop.type === 'wound'
                                      ? '伤口'
                                      : prop.type === 'makeup'
                                      ? '妆容'
                                      : '道具'}
                                  </Tag>
                                  <Text strong>{prop.name}: </Text>
                                  <Text>{prop.status}</Text>
                                  {prop.description && (
                                    <Text type="secondary" style={{ marginLeft: '8px' }}>
                                      ({prop.description})
                                    </Text>
                                  )}
                                </List.Item>
                              )}
                            />
                          </div>
                        )}

                        {hasIssues && (
                          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fff1f0', borderRadius: '4px' }}>
                            <Text strong style={{ color: '#ff4d4f' }}>
                              检测到 {sceneIssues.length} 个问题:
                            </Text>
                            <List
                              size="small"
                              style={{ marginTop: '8px' }}
                              dataSource={sceneIssues}
                              renderItem={(issue) => (
                                <List.Item>
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
                                  <Text>{issue.title}</Text>
                                </List.Item>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  ),
                }
              }).filter(Boolean)}
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <TagOutlined />
              道具状态时间线
            </span>
          }
          key="props"
        >
          <Row gutter={[16, 16]}>
            {propStatus.length === 0 ? (
              <Col span={24}>
                <Empty description="暂无道具/服装状态记录" />
              </Col>
            ) : (
              allProps.map((propName) => {
                const propRecords = propStatus
                  .filter((p) => p.name === propName)
                  .sort((a, b) => {
                    const sceneA = scenes.find((s) => s.sceneNumber === a.sceneNumber)
                    const sceneB = scenes.find((s) => s.sceneNumber === b.sceneNumber)
                    return (sceneA?.storyOrder || 0) - (sceneB?.storyOrder || 0)
                  })

                if (propRecords.length === 0) return null

                return (
                  <Col xs={24} lg={12} key={propName}>
                    <Card
                      title={
                        <span>
                          <Tag
                            color={
                              propRecords[0].type === 'costume'
                                ? 'green'
                                : propRecords[0].type === 'wound'
                                ? 'orange'
                                : propRecords[0].type === 'makeup'
                                ? 'purple'
                                : 'blue'
                            }
                          >
                            {propRecords[0].type === 'costume'
                              ? '服装'
                              : propRecords[0].type === 'wound'
                              ? '伤口'
                              : propRecords[0].type === 'makeup'
                              ? '妆容'
                              : '道具'}
                          </Tag>
                          {propName}
                          {propRecords[0].actorName && (
                            <Text type="secondary" style={{ marginLeft: '8px' }}>
                              ({propRecords[0].actorName})
                            </Text>
                          )}
                        </span>
                      }
                      size="small"
                    >
                      <Timeline
                        items={propRecords.map((record) => {
                          const scene = scenes.find((s) => s.sceneNumber === record.sceneNumber)
                          return {
                            children: (
                              <div>
                                <Text strong>场景 {record.sceneNumber}</Text>
                                {scene && (
                                  <Text type="secondary" style={{ marginLeft: '8px' }}>
                                    ({scene.sceneName}, 拍摄日期: {scene.shootDate})
                                  </Text>
                                )}
                                <br />
                                <Text>状态: </Text>
                                <Tag color="blue">{record.status}</Tag>
                                {record.description && (
                                  <Paragraph style={{ marginTop: '8px', marginBottom: 0 }}>
                                    <Text type="secondary">{record.description}</Text>
                                  </Paragraph>
                                )}
                              </div>
                            ),
                          }
                        })}
                      />
                    </Card>
                  </Col>
                )
              })
            )}
          </Row>
        </TabPane>

        <TabPane
          tab={
            <span>
              <UserOutlined />
              演员时间线
            </span>
          }
          key="actors"
        >
          <Row gutter={[16, 16]}>
            {allActors.length === 0 ? (
              <Col span={24}>
                <Empty description="暂无演员信息" />
              </Col>
            ) : (
              allActors.map((actorName) => {
                const actorScenes = sortedScenes.filter(
                  (s) =>
                    s.actors.includes(actorName) ||
                    propStatus.some((p) => p.actorName === actorName && p.sceneNumber === s.sceneNumber)
                )

                const actorProps = propStatus.filter((p) => p.actorName === actorName)
                const actorCalls = actorCalls.filter((c) => c.actorName === actorName)

                if (actorScenes.length === 0) return null

                return (
                  <Col xs={24} lg={12} key={actorName}>
                    <Card
                      title={
                        <span>
                          <UserOutlined style={{ marginRight: '8px' }} />
                          {actorName}
                          <Tag color="cyan" style={{ marginLeft: '8px' }}>
                            {actorScenes.length} 个场景
                          </Tag>
                        </span>
                      }
                      size="small"
                    >
                      <Timeline
                        items={actorScenes.map((scene) => {
                          const sceneProps = actorProps.filter((p) => p.sceneNumber === scene.sceneNumber)
                          const sceneCalls = actorCalls.filter((c) => c.sceneNumber === scene.sceneNumber)

                          return {
                            children: (
                              <div>
                                <Text strong>
                                  <Tag color="blue">{scene.sceneNumber}</Tag> {scene.sceneName}
                                </Text>
                                <br />
                                <Text type="secondary">
                                  拍摄日期: {scene.shootDate} | {scene.dayNight} | {scene.location}
                                </Text>

                                {sceneProps.length > 0 && (
                                  <div style={{ marginTop: '8px' }}>
                                    <Text strong>服装/妆容/伤口: </Text>
                                    {sceneProps.map((p) => (
                                      <div key={p.id}>
                                        <Tag
                                          color={
                                            p.type === 'costume'
                                              ? 'green'
                                              : p.type === 'wound'
                                              ? 'orange'
                                              : p.type === 'makeup'
                                              ? 'purple'
                                              : 'blue'
                                          }
                                        >
                                          {p.name}
                                        </Tag>
                                        <Text>: {p.status}</Text>
                                        {p.description && (
                                          <Text type="secondary" style={{ marginLeft: '4px' }}>
                                            ({p.description})
                                          </Text>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {sceneCalls.length > 0 && (
                                  <div style={{ marginTop: '8px' }}>
                                    <Text strong>通告信息: </Text>
                                    {sceneCalls.map((c) => (
                                      <div key={c.id}>
                                        <Text type="secondary">
                                          化妆时间: {c.makeupTime || c.callTime} | 服装: {c.costume} | 妆容: {c.makeup}
                                        </Text>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ),
                          }
                        })}
                      />
                    </Card>
                  </Col>
                )
              })
            )}
          </Row>
        </TabPane>
      </Tabs>
    </div>
  )
}

export default TimelinePage
