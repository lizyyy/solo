import React, { useState, useEffect } from 'react';
import {
  Select,
  Button,
  Space,
  Card,
  Typography,
  Tag,
  Descriptions,
  Collapse,
  Timeline,
  Row,
  Col,
  Divider,
  Alert,
  Spin,
  Empty,
  Badge,
  message
} from 'antd';
import {
  PlayCircleOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

function SingleEvaluationPage() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getAll();
      setUsers(data);
    } catch (error) {
      message.error('加载用户列表失败');
    }
  };

  const handleEvaluate = async () => {
    if (!selectedUserId) {
      message.warning('请先选择一个用户');
      return;
    }

    setLoading(true);
    try {
      const result = await api.evaluateUser(selectedUserId);
      setEvaluationResult(result);
      setExpandedKeys(result.evaluations.map(e => e.flagId));
    } catch (error) {
      message.error('评估失败');
    } finally {
      setLoading(false);
    }
  };

  const getStepStatus = (step) => {
    if (step.result === true) return 'success';
    if (step.result === false) return 'error';
    return 'info';
  };

  const getStepIcon = (step) => {
    if (step.result === true) return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (step.result === false) return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    return <WarningOutlined style={{ color: '#1890ff' }} />;
  };

  const renderEvaluationCard = (evaluation) => {
    const cardClass = `evaluation-card ${
      evaluation.overrideReason === 'Kill Switch 覆盖' 
        ? 'kill-switch' 
        : evaluation.result 
          ? 'enabled' 
          : 'disabled'
    }`;

    return (
      <Card
        key={evaluation.flagId}
        className={cardClass}
        title={
          <Space>
            <FlagBadge result={evaluation.result} overrideReason={evaluation.overrideReason} />
            <span style={{ fontWeight: 'bold' }}>{evaluation.flagName}</span>
            <code style={{ fontSize: '12px', color: '#666' }}>{evaluation.flagKey}</code>
          </Space>
        }
        extra={
          <FlagStatusBadge result={evaluation.result} overrideReason={evaluation.overrideReason} />
        }
      >
        <Alert
          message={evaluation.reason}
          type={evaluation.result ? 'success' : 'error'}
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Collapse
          activeKey={expandedKeys.includes(evaluation.flagId) ? [evaluation.flagId] : []}
          onChange={(keys) => {
            if (keys.includes(evaluation.flagId)) {
              setExpandedKeys([...expandedKeys, evaluation.flagId]);
            } else {
              setExpandedKeys(expandedKeys.filter(k => k !== evaluation.flagId));
            }
          }}
        >
          <Panel header="查看详细评估步骤" key={evaluation.flagId}>
            <Timeline
              mode="left"
              items={evaluation.steps.map((step, index) => ({
                dot: getStepIcon(step),
                color: step.result === true ? 'green' : step.result === false ? 'red' : 'blue',
                children: (
                  <div>
                    <Text strong>{step.step}</Text>
                    <Paragraph style={{ margin: '4px 0 0 0', color: '#666' }}>
                      {step.reason}
                    </Paragraph>
                    {step.dependencies && (
                      <div style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                        <Text type="secondary">依赖详情：</Text>
                        {step.dependencies.map((dep, i) => (
                          <div key={i} style={{ marginTop: 4 }}>
                            <Badge status={dep.result ? 'success' : 'error'} />
                            <Text strong>{dep.flagName}</Text>
                            <Text type="secondary" style={{ marginLeft: 8 }}>
                              ({dep.flagKey}) - {dep.reason}
                            </Text>
                          </div>
                        ))}
                      </div>
                    )}
                    {step.segments && (
                      <div style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                        <Text type="secondary">Segment 匹配详情：</Text>
                        {step.segments.map((seg, i) => (
                          <div key={i} style={{ marginTop: 4 }}>
                            <Badge status={seg.matches ? 'success' : 'error'} />
                            <Text strong>{seg.segmentName}</Text>
                            {seg.matchResults && (
                              <div style={{ marginLeft: 20, marginTop: 4 }}>
                                {seg.matchResults.map((mr, j) => (
                                  <div key={j}>
                                    <Badge status={mr.matches ? 'success' : 'error'} />
                                    <Text type="secondary">{mr.reason}</Text>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {step.bucket !== undefined && (
                      <div style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                        <Text type="secondary">百分比分桶详情：</Text>
                        <div style={{ marginTop: 4 }}>
                          <Text>用户分桶: <Tag color={step.result ? 'green' : 'red'}>{step.bucket}</Tag></Text>
                          <Text style={{ marginLeft: 16 }}>灰度阈值: <Tag>{step.percentage}%</Tag></Text>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }))}
            />
          </Panel>
        </Collapse>
      </Card>
    );
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <UserOutlined />
            单用户演练
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadUsers}>
            刷新用户列表
          </Button>
        }
      >
        <Alert
          message="选择一个用户，查看每个 Flag 的最终状态和详细的规则链路"
          description="可以看到：Kill Switch 是否覆盖、依赖检查结果、Segment 匹配情况、百分比分桶计算"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={16} align="middle">
          <Col flex="1">
            <Select
              placeholder="请选择一个用户"
              style={{ width: '100%' }}
              value={selectedUserId}
              onChange={setSelectedUserId}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {users.map(user => (
                <Option key={user.id} value={user.id}>
                  <Space>
                    <UserOutlined />
                    <strong>{user.name}</strong>
                    <Text type="secondary">{user.email}</Text>
                    <Tag>{user.region}</Tag>
                    <Tag>{user.accountType}</Tag>
                  </Space>
                </Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleEvaluate}
              loading={loading}
              size="large"
            >
              开始演练
            </Button>
          </Col>
        </Row>
      </Card>

      {loading && (
        <Card style={{ marginTop: 16, textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>正在评估...</div>
        </Card>
      )}

      {evaluationResult && !loading && (
        <div style={{ marginTop: 16 }}>
          <Card
            title={
              <Space>
                <UserOutlined />
                用户信息
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Descriptions column={4} bordered>
              <Descriptions.Item label="姓名">{evaluationResult.user.name}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{evaluationResult.user.email}</Descriptions.Item>
              <Descriptions.Item label="地区">
                <Tag color="blue">{evaluationResult.user.region}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="账号类型">
                <Tag>{evaluationResult.user.accountType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="注册天数">{evaluationResult.user.registerDays} 天</Descriptions.Item>
              <Descriptions.Item label="标签" span={3}>
                <Space wrap>
                  {(evaluationResult.user.tags || []).map((tag, i) => (
                    <Tag key={i}>{tag}</Tag>
                  ))}
                  {(!evaluationResult.user.tags || evaluationResult.user.tags.length === 0) && (
                    <Text type="secondary">无标签</Text>
                  )}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Title level={4} style={{ marginBottom: 16 }}>
            评估结果
            <Space style={{ marginLeft: 16 }}>
              <Tag color="green">
                命中: {evaluationResult.evaluations.filter(e => e.result).length}
              </Tag>
              <Tag color="red">
                未命中: {evaluationResult.evaluations.filter(e => !e.result).length}
              </Tag>
              {evaluationResult.evaluations.some(e => e.overrideReason) && (
                <Tag color="orange">
                  被覆盖: {evaluationResult.evaluations.filter(e => e.overrideReason).length}
                </Tag>
              )}
            </Space>
          </Title>

          {evaluationResult.evaluations.map(renderEvaluationCard)}
        </div>
      )}

      {!evaluationResult && !loading && (
        <Card style={{ marginTop: 16 }}>
          <Empty
            description="选择用户并点击开始演练查看结果"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
    </div>
  );
}

function FlagBadge({ result, overrideReason }) {
  if (overrideReason === 'Kill Switch 覆盖') {
    return <WarningOutlined style={{ color: '#faad14' }} />;
  }
  return result 
    ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
    : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
}

function FlagStatusBadge({ result, overrideReason }) {
  if (overrideReason === 'Kill Switch 覆盖') {
    return (
      <span className="flag-status-badge kill-switch">
        <WarningOutlined /> Kill Switch 覆盖
      </span>
    );
  }
  return result 
    ? (
      <span className="flag-status-badge enabled">
        <CheckCircleOutlined /> 命中
      </span>
    )
    : (
      <span className="flag-status-badge disabled">
        <CloseCircleOutlined /> 未命中
      </span>
    );
}

export default SingleEvaluationPage;
