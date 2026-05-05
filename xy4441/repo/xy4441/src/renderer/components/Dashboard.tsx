import React from 'react';
import { Row, Col, Card, Statistic, List, Typography, Tag, Empty, Button } from 'antd';
import {
  CalendarOutlined,
  ShoppingOutlined,
  WarningOutlined,
  PictureOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useApp } from '../store/AppContext';
import { RiskItem } from '../../shared/types';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const {
    scenes,
    costumes,
    photos,
    risks,
    currentProject,
    runRiskAnalysis,
  } = useApp();

  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  const activeRisks = risks.filter((r) => !r.isResolved);
  const highRisks = activeRisks.filter((r) => r.severity === 'high');
  const mediumRisks = activeRisks.filter((r) => r.severity === 'medium');

  const sortedScenes = [...scenes].sort((a, b) =>
    a.shootDate.localeCompare(b.shootDate)
  );
  const upcomingScenes = sortedScenes.filter(
    (s) => s.shootDate >= new Date().toISOString().split('T')[0]
  );
  const nextScenes = upcomingScenes.slice(0, 5);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      await runRiskAnalysis();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      missing_item: '缺件',
      wash_conflict: '清洗冲突',
      size_unconfirmed: '尺码未确认',
      photo_mismatch: '照片不匹配',
      alteration_delay: '改衣延迟',
    };
    return labels[type] || type;
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      high: 'error',
      medium: 'warning',
      low: 'success',
    };
    return (colors[severity] as any) || 'default';
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stats-card">
              <Statistic
                title="场次数量"
                value={scenes.length}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stats-card">
              <Statistic
                title="服装数量"
                value={costumes.length}
                prefix={<ShoppingOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stats-card">
              <Statistic
                title="参考照片"
                value={photos.length}
                prefix={<PictureOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stats-card">
              <Statistic
                title="未解决风险"
                value={activeRisks.length}
                prefix={<WarningOutlined />}
                valueStyle={{ color: highRisks.length > 0 ? '#ff4d4f' : '#52c41a' }}
              />
              {highRisks.length > 0 && (
                <Text type="danger" style={{ fontSize: 12 }}>
                  其中 {highRisks.length} 项高风险
                </Text>
              )}
            </Card>
          </Col>
        </Row>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <WarningOutlined />
                <span>风险预警</span>
              </Space>
            }
            className="panel-card"
            extra={
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleRunAnalysis}
                loading={isAnalyzing}
                size="small"
              >
                重新分析
              </Button>
            }
          >
            {activeRisks.length === 0 ? (
              <Empty
                description="暂无风险预警"
                style={{ padding: 32 }}
              >
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleRunAnalysis}
                  loading={isAnalyzing}
                >
                  运行风险分析
                </Button>
              </Empty>
            ) : (
              <List
                dataSource={activeRisks.slice(0, 10)}
                renderItem={(risk) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Tag color={getSeverityColor(risk.severity)}>
                          {risk.severity === 'high'
                            ? '高'
                            : risk.severity === 'medium'
                            ? '中'
                            : '低'}
                        </Tag>
                      }
                      title={
                        <Space>
                          <span>{risk.title}</span>
                          <Tag>{getRiskTypeLabel(risk.type)}</Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <Text type="secondary">{risk.description}</Text>
                          {risk.affectedDate && (
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary">
                                影响日期: {risk.affectedDate}
                              </Text>
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                <span>近期场次</span>
              </Space>
            }
            className="panel-card"
          >
            {nextScenes.length === 0 ? (
              <Empty
                description="暂无场次数据"
                style={{ padding: 32 }}
              />
            ) : (
              <List
                dataSource={nextScenes}
                renderItem={(scene) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 8,
                            background: '#e6f7ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text strong style={{ color: '#1890ff' }}>
                            {scene.sceneNumber}
                          </Text>
                        </div>
                      }
                      title={scene.sceneName || scene.sceneNumber}
                      description={
                        <div>
                          <div>
                            <Text type="secondary">拍摄日期: </Text>
                            <Text strong>{scene.shootDate}</Text>
                          </div>
                          {scene.location && (
                            <div>
                              <Text type="secondary">地点: </Text>
                              <Text>{scene.location}</Text>
                            </div>
                          )}
                          {scene.characters.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary">角色: </Text>
                              {scene.characters.map((c, i) => (
                                <Tag key={i} size="small">
                                  {c}
                                </Tag>
                              ))}
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card
            title="快速统计"
            className="panel-card"
            style={{ marginTop: 16 }}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="高风险"
                  value={highRisks.length}
                  valueStyle={{ color: '#ff4d4f', fontSize: 24 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="中风险"
                  value={mediumRisks.length}
                  valueStyle={{ color: '#faad14', fontSize: 24 }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
