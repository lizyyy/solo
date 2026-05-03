import React, { useState, useEffect } from 'react';
import {
  Button,
  Space,
  Card,
  Typography,
  Tag,
  Table,
  Collapse,
  Row,
  Col,
  Divider,
  Alert,
  Spin,
  Empty,
  Statistic,
  Progress,
  Tabs,
  List,
  Descriptions,
  Badge,
  Select,
  message
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  BarChartOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;
const { TabPane } = Tabs;

function BatchEvaluationPage() {
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');

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
    setLoading(true);
    try {
      const userIds = selectedUserIds.length > 0 ? selectedUserIds : null;
      const result = await api.evaluateBatch(userIds);
      setEvaluationResult(result);
    } catch (error) {
      message.error('批量评估失败');
    } finally {
      setLoading(false);
    }
  };

  const renderStatsTab = () => {
    if (!evaluationResult || !evaluationResult.analysis) {
      return <Empty description="请先执行批量演练" />;
    }

    const { analysis } = evaluationResult;

    return (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="总用户数"
                value={analysis.totalUsers}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="总 Flag 数"
                value={analysis.totalFlags}
                prefix={<BarChartOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="冲突数"
                value={analysis.conflicts.length}
                prefix={<WarningOutlined />}
                valueStyle={{ color: analysis.conflicts.length > 0 ? '#faad14' : '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="异常用户"
                value={analysis.anomalies.length}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: analysis.anomalies.length > 0 ? '#ff4d4f' : '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        <Title level={4}>各 Flag 命中统计</Title>
        <Table
          dataSource={analysis.flagStats}
          rowKey="flagKey"
          pagination={false}
          columns={[
            {
              title: 'Flag',
              dataIndex: 'flagName',
              key: 'flagName',
              render: (text, record) => (
                <div>
                  <strong>{text}</strong>
                  <div>
                    <Text type="secondary" code>{record.flagKey}</Text>
                  </div>
                </div>
              )
            },
            {
              title: '总评估',
              dataIndex: 'total',
              key: 'total',
              width: 100,
              align: 'center'
            },
            {
              title: '命中统计',
              key: 'hitStats',
              render: (_, record) => {
                const enabledPercent = record.total > 0 
                  ? Math.round((record.enabled / record.total) * 100) 
                  : 0;
                const disabledPercent = 100 - enabledPercent;
                
                return (
                  <div style={{ minWidth: 200 }}>
                    <div style={{ marginBottom: 4 }}>
                      <Tag color="green">命中: {record.enabled} ({enabledPercent}%)</Tag>
                      <Tag color="red">未命中: {record.disabled} ({disabledPercent}%)</Tag>
                    </div>
                    <Progress
                      percent={enabledPercent}
                      strokeColor="#52c41a"
                      trailColor="#ff4d4f"
                      showInfo={false}
                    />
                  </div>
                );
              }
            },
            {
              title: '关闭原因分布',
              key: 'reasons',
              render: (_, record) => (
                <Space wrap>
                  {record.killSwitchOverride > 0 && (
                    <Tag color="orange">Kill Switch: {record.killSwitchOverride}</Tag>
                  )}
                  {record.dependencyBlocked > 0 && (
                    <Tag color="blue">依赖阻止: {record.dependencyBlocked}</Tag>
                  )}
                  {record.segmentMissed > 0 && (
                    <Tag color="cyan">Segment 未匹配: {record.segmentMissed}</Tag>
                  )}
                  {record.percentageMissed > 0 && (
                    <Tag color="purple">分桶未命中: {record.percentageMissed}</Tag>
                  )}
                  {record.globalDisabled > 0 && (
                    <Tag color="default">全局关闭: {record.globalDisabled}</Tag>
                  )}
                </Space>
              )
            }
          ]}
        />
      </div>
    );
  };

  const renderConflictsTab = () => {
    if (!evaluationResult || !evaluationResult.analysis) {
      return <Empty description="请先执行批量演练" />;
    }

    const { analysis } = evaluationResult;

    if (analysis.conflicts.length === 0) {
      return (
        <Alert
          message="没有冲突"
          description="所有用户的 Flag 评估都没有被覆盖的情况"
          type="success"
          showIcon
        />
      );
    }

    return (
      <List
        dataSource={analysis.conflicts}
        renderItem={(conflict) => (
          <List.Item>
            <Card
              className="conflict-card"
              title={
                <Space>
                  <WarningOutlined style={{ color: '#faad14' }} />
                  <strong>{conflict.user.name}</strong>
                  <Text type="secondary">{conflict.user.email}</Text>
                </Space>
              }
              size="small"
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="地区">{conflict.user.region}</Descriptions.Item>
                <Descriptions.Item label="账号类型">{conflict.user.accountType}</Descriptions.Item>
                <Descriptions.Item label="注册天数">{conflict.user.registerDays} 天</Descriptions.Item>
              </Descriptions>
              <Divider style={{ margin: '12px 0' }} />
              <Title level={5}>被覆盖的 Flag:</Title>
              <List
                dataSource={conflict.overrideFlags}
                size="small"
                renderItem={(flag) => (
                  <List.Item>
                    <Space>
                      <Badge status="warning" />
                      <strong>{flag.flagName}</strong>
                      <Text code>({flag.flagKey})</Text>
                      <Text type="secondary">→</Text>
                      <Tag color="orange">{flag.overrideReason}</Tag>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </List.Item>
        )}
      />
    );
  };

  const renderAnomaliesTab = () => {
    if (!evaluationResult || !evaluationResult.analysis) {
      return <Empty description="请先执行批量演练" />;
    }

    const { analysis } = evaluationResult;

    if (analysis.anomalies.length === 0) {
      return (
        <Alert
          message="没有异常"
          description="所有用户的 Flag 评估都正常"
          type="success"
          showIcon
        />
      );
    }

    return (
      <List
        dataSource={analysis.anomalies}
        renderItem={(anomaly) => (
          <List.Item>
            <Card
              className="anomaly-card"
              title={
                <Space>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                  <strong>{anomaly.user.name}</strong>
                  <Text type="secondary">{anomaly.user.email}</Text>
                </Space>
              }
              size="small"
            >
              <Title level={5}>异常类型:</Title>
              <List
                dataSource={anomaly.anomalies}
                size="small"
                renderItem={(a) => (
                  <List.Item>
                    <Space>
                      <Badge status="warning" />
                      <Text strong>{a.type}</Text>
                      <Text type="secondary">{a.message}</Text>
                    </Space>
                    {a.flags && (
                      <div style={{ marginLeft: 24, marginTop: 4 }}>
                        涉及 Flag: {a.flags.map(f => <Tag key={f}>{f}</Tag>)}
                      </div>
                    )}
                  </List.Item>
                )}
              />
            </Card>
          </List.Item>
        )}
      />
    );
  };

  const renderUsersTab = () => {
    if (!evaluationResult) {
      return <Empty description="请先执行批量演练" />;
    }

    const columns = [
      {
        title: '用户',
        dataIndex: 'user',
        key: 'user',
        render: (user) => (
          <div>
            <strong>{user.name}</strong>
            <div>
              <Text type="secondary">{user.email}</Text>
            </div>
          </div>
        )
      },
      {
        title: '命中',
        key: 'enabled',
        width: 80,
        align: 'center',
        render: (_, record) => {
          const enabled = record.evaluations.filter(e => e.result).length;
          return <Tag color="green">{enabled}</Tag>;
        }
      },
      {
        title: '未命中',
        key: 'disabled',
        width: 80,
        align: 'center',
        render: (_, record) => {
          const disabled = record.evaluations.filter(e => !e.result).length;
          return <Tag color="red">{disabled}</Tag>;
        }
      },
      {
        title: '被覆盖',
        key: 'overridden',
        width: 80,
        align: 'center',
        render: (_, record) => {
          const overridden = record.evaluations.filter(e => e.overrideReason).length;
          return overridden > 0 
            ? <Tag color="orange">{overridden}</Tag>
            : <Tag color="default">0</Tag>;
        }
      },
      {
        title: '详情',
        key: 'details',
        render: (_, record) => (
          <Collapse ghost>
            <Panel header="查看所有 Flag 结果" key="1">
              <Space direction="vertical" style={{ width: '100%' }}>
                {record.evaluations.map((evalItem) => (
                  <Card
                    key={evalItem.flagId}
                    size="small"
                    title={
                      <Space>
                        {evalItem.overrideReason 
                          ? <WarningOutlined style={{ color: '#faad14' }} />
                          : evalItem.result 
                            ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        }
                        <strong>{evalItem.flagName}</strong>
                        <Text code>({evalItem.flagKey})</Text>
                      </Space>
                    }
                  >
                    <Alert
                      message={evalItem.reason}
                      type={evalItem.result ? 'success' : 'error'}
                      showIcon
                    />
                    {evalItem.overrideReason && (
                      <Alert
                        message={evalItem.overrideReason}
                        type="warning"
                        showIcon
                        style={{ marginTop: 8 }}
                      />
                    )}
                  </Card>
                ))}
              </Space>
            </Panel>
          </Collapse>
        )
      }
    ];

    return (
      <Table
        columns={columns}
        dataSource={evaluationResult.results}
        rowKey={(record) => record.user.id}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`
        }}
      />
    );
  };

  return (
    <div>
      <Card
        title={
          <Space>
            <BarChartOutlined />
            批量演练
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadUsers}>
            刷新
          </Button>
        }
      >
        <Alert
          message="对所有用户或选定用户进行批量演练，查看统计数据、冲突和异常用户"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={16} align="middle">
          <Col flex="1">
            <Select
              mode="multiple"
              placeholder="选择用户（不选则评估所有用户）"
              style={{ width: '100%' }}
              value={selectedUserIds}
              onChange={setSelectedUserIds}
              showSearch
              optionFilterProp="children"
              maxTagCount={5}
            >
              {users.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.name} ({user.email})
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
              开始批量演练
            </Button>
          </Col>
        </Row>
      </Card>

      {loading && (
        <Card style={{ marginTop: 16, textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>正在执行批量评估...</div>
        </Card>
      )}

      {evaluationResult && !loading && (
        <Card style={{ marginTop: 16 }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="统计概览" key="stats">
              {renderStatsTab()}
            </TabPane>
            <TabPane tab={
              <span>
                冲突列表
                {evaluationResult.analysis?.conflicts.length > 0 && (
                  <Badge count={evaluationResult.analysis.conflicts.length} style={{ marginLeft: 8 }} />
                )}
              </span>
            } key="conflicts">
              {renderConflictsTab()}
            </TabPane>
            <TabPane tab={
              <span>
                异常用户
                {evaluationResult.analysis?.anomalies.length > 0 && (
                  <Badge count={evaluationResult.analysis.anomalies.length} style={{ marginLeft: 8 }} />
                )}
              </span>
            } key="anomalies">
              {renderAnomaliesTab()}
            </TabPane>
            <TabPane tab="所有用户详情" key="users">
              {renderUsersTab()}
            </TabPane>
          </Tabs>
        </Card>
      )}

      {!evaluationResult && !loading && (
        <Card style={{ marginTop: 16 }}>
          <Empty
            description="点击开始批量演练查看结果"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      )}
    </div>
  );
}

export default BatchEvaluationPage;
