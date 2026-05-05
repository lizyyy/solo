import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Tabs,
  Timeline,
  Tag,
  Badge,
  Descriptions,
  Modal,
  Divider,
  Statistic,
  Alert,
  Collapse,
  Radio,
  List,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  EyeOutlined,
  ReloadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { experimentApi } from '../api';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { Option } = Select;
const { Panel } = Collapse;
const { TextArea } = Input;

function ExperimentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [experiment, setExperiment] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('nodes');
  const [addNodeForm] = Form.useForm();
  const [writeForm] = Form.useForm();
  const [lockForm] = Form.useForm();
  const [readForm] = Form.useForm();

  const loadExperimentData = useCallback(async () => {
    setLoading(true);
    try {
      const [expResult, nodesResult, timelineResult, logsResult] = await Promise.all([
        experimentApi.getById(id),
        experimentApi.getNodes(id),
        experimentApi.getTimeline(id),
        experimentApi.getLogs(id),
      ]);
      
      setExperiment(expResult.data);
      setNodes(nodesResult.data || []);
      setTimeline(timelineResult.data || []);
      setLogs(logsResult.data || []);
    } catch (error) {
      message.error('加载实验数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadExperimentData();
  }, [loadExperimentData]);

  const handleAddNode = async (values) => {
    try {
      await experimentApi.createNode(id, {
        name: values.name,
        role: values.role || 'follower',
      });
      message.success('节点添加成功！');
      addNodeForm.resetFields();
      loadExperimentData();
    } catch (error) {
      message.error('添加节点失败: ' + error.message);
    }
  };

  const handleSimulateWrite = async (values) => {
    try {
      const result = await experimentApi.simulateWrite(id, {
        key: values.key,
        value: values.value,
        consistencyModel: values.consistencyModel || experiment?.consistency_model,
      });
      
      if (result.data?.success) {
        message.success(result.data.message);
      } else {
        message.warning(result.data?.message || '写入失败');
      }
      
      writeForm.resetFields();
      loadExperimentData();
    } catch (error) {
      message.error('写入失败: ' + error.message);
    }
  };

  const handleSimulateLeaderFailure = async () => {
    try {
      const result = await experimentApi.simulateLeaderFailure(id);
      message.success(result.data?.message || 'Leader 宕机模拟完成');
      loadExperimentData();
    } catch (error) {
      message.error('模拟 Leader 宕机失败: ' + error.message);
    }
  };

  const handleAcquireLock = async (values) => {
    try {
      const result = await experimentApi.acquireLock(id, {
        lockKey: values.lockKey,
        nodeId: values.nodeId,
        timeout: values.timeout || 10000,
      });
      
      if (result.data?.success) {
        message.success(result.data.message);
      } else {
        message.warning(result.data?.message || '获取锁失败');
      }
      
      loadExperimentData();
    } catch (error) {
      message.error('获取锁失败: ' + error.message);
    }
  };

  const handleReleaseLock = async (values) => {
    try {
      const result = await experimentApi.releaseLock(id, {
        lockKey: values.lockKey,
        nodeId: values.nodeId,
      });
      
      if (result.data?.success) {
        message.success(result.data.message);
      } else {
        message.warning(result.data?.message || '释放锁失败');
      }
      
      loadExperimentData();
    } catch (error) {
      message.error('释放锁失败: ' + error.message);
    }
  };

  const handleSimulateStaleRead = async (values) => {
    try {
      const result = await experimentApi.simulateStaleRead(id, {
        key: values.key,
        nodeId: values.nodeId,
      });
      
      if (result.data?.isStale) {
        Modal.warning({
          title: '脏读检测',
          content: (
            <div>
              <Alert
                message="检测到脏读！"
                description={result.data.message}
                type="warning"
                showIcon
              />
              <Divider />
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="读取节点">{result.data.nodeName}</Descriptions.Item>
                <Descriptions.Item label="读取键">{result.data.key}</Descriptions.Item>
                <Descriptions.Item label="读取值">{JSON.stringify(result.data.readValue)}</Descriptions.Item>
                <Descriptions.Item label="最新值">{JSON.stringify(result.data.latestValue)}</Descriptions.Item>
              </Descriptions>
            </div>
          ),
        });
      } else {
        message.info(result.data.message);
      }
      
      loadExperimentData();
    } catch (error) {
      message.error('读取失败: ' + error.message);
    }
  };

  const handleExportReport = async (format) => {
    try {
      const result = await experimentApi.getReport(id, format);
      setReport(result.data);
      
      if (format === 'markdown') {
        const blob = new Blob([result], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `experiment-report-${id}.md`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('Markdown 报告已下载');
      } else {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `experiment-report-${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('JSON 报告已下载');
      }
    } catch (error) {
      message.error('生成报告失败: ' + error.message);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'leader': return 'blue';
      case 'candidate': return 'orange';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    return status === 'active' ? 'success' : 'error';
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'WRITE_START':
      case 'NODE_WRITE':
      case 'RAFT_LEADER_RECEIVE':
      case 'PAXOS_PREPARE':
        return <DatabaseOutlined style={{ color: '#1890ff' }} />;
      case 'WRITE_COMPLETE':
      case 'RAFT_COMMIT':
      case 'PAXOS_CHOSEN':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'RAFT_ELECTION_START':
      case 'RAFT_FOLLOWER_ACK':
        return <ThunderboltOutlined style={{ color: '#faad14' }} />;
      case 'RAFT_LEADER_ELECTED':
        return <CheckCircleOutlined style={{ color: '#1890ff' }} />;
      case 'LEADER_FAILURE':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'LOCK_ACQUIRED':
        return <LockOutlined style={{ color: '#722ed1' }} />;
      case 'LOCK_RELEASED':
        return <UnlockOutlined style={{ color: '#13c2c2' }} />;
      case 'STALE_READ':
        return <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />;
      default:
        return <EyeOutlined style={{ color: '#666' }} />;
    }
  };

  const getLogLevelColor = (level) => {
    switch (level) {
      case 'INFO': return 'success';
      case 'WARN': return 'warning';
      case 'ERROR': return 'error';
      default: return 'default';
    }
  };

  const getConsistencyLabel = (model) => {
    const labels = {
      strong: '强一致性',
      eventual: '最终一致性',
      raft: 'Raft 算法',
      paxos: 'Paxos 算法',
    };
    return labels[model] || model;
  };

  if (!experiment && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Alert message="加载中..." type="info" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
          style={{ marginBottom: 16 }}
        >
          返回实验列表
        </Button>
        
        <Card>
          <Descriptions title="实验信息" bordered column={4}>
            <Descriptions.Item label="实验名称">{experiment?.name}</Descriptions.Item>
            <Descriptions.Item label="一致性模型">
              <Tag color="blue">{getConsistencyLabel(experiment?.consistency_model)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Seed">
              <Tag color="cyan">{experiment?.seed}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="节点数">{nodes.length}</Descriptions.Item>
          </Descriptions>
        </Card>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="节点与操作" key="nodes">
          <Row gutter={24}>
            <Col span={16}>
              <Card
                title={
                  <Space>
                    <DatabaseOutlined />
                    节点可视化
                  </Space>
                }
                extra={
                  <Button icon={<ReloadOutlined />} onClick={loadExperimentData}>
                    刷新
                  </Button>
                }
              >
                {nodes.length === 0 ? (
                  <Alert
                    message="暂无节点"
                    description="请在右侧添加节点"
                    type="info"
                    showIcon
                  />
                ) : (
                  <div className="node-visualization">
                    {nodes.map((node) => (
                      <Card
                        key={node.id}
                        className={`node-card ${node.role} ${node.status === 'down' ? 'down' : ''}`}
                        bordered
                      >
                        <Card.Meta
                          title={
                            <Space>
                              <Badge
                                status={getStatusColor(node.status)}
                                text={node.status === 'active' ? '在线' : '宕机'}
                              />
                              <strong>{node.name}</strong>
                            </Space>
                          }
                          description={
                            <div>
                              <Tag color={getRoleColor(node.role)}>
                                {node.role === 'leader' ? 'Leader' : node.role === 'candidate' ? 'Candidate' : 'Follower'}
                              </Tag>
                              {node.term > 0 && (
                                <Tag color="purple">任期: {node.term}</Tag>
                              )}
                              <Divider style={{ margin: '8px 0' }} />
                              <div className="data-display">
                                <strong>数据:</strong>
                                <pre style={{ margin: 0, fontSize: 11 }}>
                                  {JSON.stringify(node.data, null, 2)}
                                </pre>
                              </div>
                            </div>
                          }
                        />
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </Col>

            <Col span={8}>
              <Card title="操作面板" className="operation-panel">
                <Collapse defaultActiveKey={['addNode']}>
                  <Panel header="添加节点" key="addNode">
                    <Form form={addNodeForm} layout="vertical" onFinish={handleAddNode}>
                      <Form.Item
                        name="name"
                        label="节点名称"
                        rules={[{ required: true, message: '请输入节点名称' }]}
                      >
                        <Input placeholder="例如：node-1" />
                      </Form.Item>
                      <Form.Item name="role" label="初始角色" initialValue="follower">
                        <Select>
                          <Option value="follower">Follower</Option>
                          <Option value="leader">Leader</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<PlusOutlined />} block>
                          添加节点
                        </Button>
                      </Form.Item>
                    </Form>
                  </Panel>

                  <Panel header="模拟写入" key="write">
                    <Form form={writeForm} layout="vertical" onFinish={handleSimulateWrite}>
                      <Form.Item
                        name="key"
                        label="键 (Key)"
                        rules={[{ required: true, message: '请输入键名' }]}
                      >
                        <Input placeholder="例如：counter" />
                      </Form.Item>
                      <Form.Item
                        name="value"
                        label="值 (Value)"
                        rules={[{ required: true, message: '请输入值' }]}
                      >
                        <Input placeholder="例如：123" />
                      </Form.Item>
                      <Form.Item name="consistencyModel" label="一致性模型">
                        <Select placeholder="使用实验默认模型">
                          <Option value="strong">强一致性</Option>
                          <Option value="eventual">最终一致性</Option>
                          <Option value="raft">Raft</Option>
                          <Option value="paxos">Paxos</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<DatabaseOutlined />} block>
                          执行写入
                        </Button>
                      </Form.Item>
                    </Form>
                  </Panel>

                  <Panel header="模拟故障" key="failure">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Button
                        type="primary"
                        danger
                        icon={<ThunderboltOutlined />}
                        onClick={handleSimulateLeaderFailure}
                        block
                      >
                        模拟 Leader 宕机
                      </Button>
                      <Alert
                        message="说明"
                        description="此操作会将当前 Leader 节点标记为宕机状态，用于观察重新选举过程。"
                        type="info"
                        showIcon
                      />
                    </Space>
                  </Panel>

                  <Panel header="分布式锁" key="lock">
                    <Form form={lockForm} layout="vertical">
                      <Form.Item
                        name="lockKey"
                        label="锁名称"
                        rules={[{ required: true, message: '请输入锁名称' }]}
                      >
                        <Input placeholder="例如：resource-lock" />
                      </Form.Item>
                      <Form.Item
                        name="nodeId"
                        label="节点"
                        rules={[{ required: true, message: '请选择节点' }]}
                      >
                        <Select placeholder="选择节点">
                          {nodes.map((node) => (
                            <Option key={node.id} value={node.id}>
                              {node.name} ({node.role})
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item name="timeout" label="超时时间 (ms)" initialValue={10000}>
                        <InputNumber min={1000} max={60000} style={{ width: '100%' }} />
                      </Form.Item>
                      <Space>
                        <Form.Item style={{ marginBottom: 0 }}>
                          <Button
                            type="primary"
                            icon={<LockOutlined />}
                            onClick={() => {
                              lockForm.validateFields().then(handleAcquireLock);
                            }}
                          >
                            获取锁
                          </Button>
                        </Form.Item>
                        <Form.Item style={{ marginBottom: 0 }}>
                          <Button
                            icon={<UnlockOutlined />}
                            onClick={() => {
                              lockForm.validateFields().then(handleReleaseLock);
                            }}
                          >
                            释放锁
                          </Button>
                        </Form.Item>
                      </Space>
                    </Form>
                  </Panel>

                  <Panel header="模拟脏读" key="staleRead">
                    <Form form={readForm} layout="vertical" onFinish={handleSimulateStaleRead}>
                      <Form.Item
                        name="key"
                        label="读取键"
                        rules={[{ required: true, message: '请输入键名' }]}
                      >
                        <Input placeholder="例如：counter" />
                      </Form.Item>
                      <Form.Item
                        name="nodeId"
                        label="读取节点"
                        rules={[{ required: true, message: '请选择节点' }]}
                      >
                        <Select placeholder="选择要读取的节点">
                          {nodes.map((node) => (
                            <Option key={node.id} value={node.id}>
                              {node.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<EyeOutlined />} block>
                          检查脏读
                        </Button>
                      </Form.Item>
                      <Alert
                        message="说明"
                        description="此操作会检查指定节点上的数据是否与其他节点一致，用于演示最终一致性下的脏读现象。"
                        type="info"
                        showIcon
                      />
                    </Form>
                  </Panel>
                </Collapse>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="时间线" key="timeline">
          <Card title="事件时间线">
            {timeline.length === 0 ? (
              <Alert message="暂无事件记录" type="info" showIcon />
            ) : (
              <div className="timeline-container">
                <Timeline mode="left">
                  {[...timeline].reverse().map((event, index) => (
                    <Timeline.Item
                      key={event.id}
                      dot={getEventIcon(event.event_type)}
                      color={
                        event.event_type.includes('FAILURE') || event.event_type.includes('STALE')
                          ? 'red'
                          : event.event_type.includes('ELECTED') || event.event_type.includes('COMMIT')
                          ? 'green'
                          : 'blue'
                      }
                    >
                      <div>
                        <Space>
                          <Tag color="blue">{event.event_type}</Tag>
                          <span style={{ color: '#999', fontSize: 12 }}>
                            {dayjs(event.timestamp).format('HH:mm:ss.SSS')}
                          </span>
                        </Space>
                        <div style={{ marginTop: 4, fontSize: 14 }}>
                          {event.details && Object.keys(event.details).length > 0 && (
                            <pre className="data-display" style={{ marginTop: 8 }}>
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </div>
            )}
          </Card>
        </TabPane>

        <TabPane tab="日志" key="logs">
          <Card title="节点日志">
            {logs.length === 0 ? (
              <Alert message="暂无日志记录" type="info" showIcon />
            ) : (
              <div className="log-container">
                {logs.map((log) => (
                  <div key={log.id} className={`log-entry ${log.log_level}`}>
                    <Space>
                      <Tag color={getLogLevelColor(log.log_level)}>{log.log_level}</Tag>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        {dayjs(log.timestamp).format('HH:mm:ss.SSS')}
                      </span>
                      {log.node_id && (
                        <Tag color="cyan">节点</Tag>
                      )}
                    </Space>
                    <div style={{ marginTop: 4 }}>{log.message}</div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <pre className="data-display" style={{ marginTop: 4, fontSize: 11 }}>
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabPane>

        <TabPane tab="报告导出" key="report">
          <Card title="实验报告">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="报告说明"
                description="报告包含实验概览、统计摘要、节点状态、时间线、风险分析、Seed 数据和异常配置提示。"
                type="info"
                showIcon
              />
              
              <Divider />
              
              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title="JSON 格式">
                    <p>适合程序解析和数据交换</p>
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={() => handleExportReport('json')}
                    >
                      下载 JSON 报告
                    </Button>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="Markdown 格式">
                    <p>适合人工阅读和文档整理</p>
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={() => handleExportReport('markdown')}
                    >
                      下载 Markdown 报告
                    </Button>
                  </Card>
                </Col>
              </Row>

              <Divider />

              <Card title="一致性模型对比" className="consistency-comparison">
                <List
                  dataSource={[
                    {
                      name: '强一致性 (Strong)',
                      pros: ['数据始终一致', '读取简单', '符合直觉'],
                      cons: ['写入延迟高', '可用性差', '分区容错差'],
                      scenario: '银行转账、订单处理等需要强一致的场景',
                    },
                    {
                      name: '最终一致性 (Eventual)',
                      pros: ['写入延迟低', '可用性高', '分区容错好'],
                      cons: ['存在短暂不一致', '可能读到旧值', '需要处理冲突'],
                      scenario: '社交网络、新闻推荐等对延迟敏感的场景',
                    },
                    {
                      name: 'Raft',
                      pros: ['易于理解', ' Leader 选举高效', '日志复制清晰'],
                      cons: ['依赖 Leader', '多数确认有延迟', '实现复杂'],
                      scenario: '分布式配置管理、服务发现等需要共识的场景',
                    },
                    {
                      name: 'Paxos',
                      pros: ['理论完善', '无需固定 Leader', '容错能力强'],
                      cons: ['难以理解', '实现复杂', '多轮通信开销大'],
                      scenario: '大型分布式系统、状态机复制等核心场景',
                    },
                  ]}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={<strong>{item.name}</strong>}
                        description={
                          <div>
                            <p><strong>优点:</strong> {item.pros.join('、')}</p>
                            <p><strong>缺点:</strong> {item.cons.join('、')}</p>
                            <p><strong>适用场景:</strong> {item.scenario}</p>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Space>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}

export default ExperimentPage;
