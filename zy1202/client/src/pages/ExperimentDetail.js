import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Spin,
  message,
  Tabs,
  Table,
  Tag,
  Statistic,
  Row,
  Col,
  Progress,
  List,
  Timeline,
  Alert
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  DownloadOutlined,
  BarChartOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import api from '../api';

const { TabPane } = Tabs;

const ExperimentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [experiment, setExperiment] = useState(null);
  const [simulationResults, setSimulationResults] = useState(null);
  const [risks, setRisks] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (id) {
      loadExperiment();
    }
  }, [id]);

  const loadExperiment = async () => {
    try {
      setLoading(true);
      
      const expResponse = await api.experiments.getById(id);
      if (expResponse.success) {
        setExperiment(expResponse.data);
        
        if (expResponse.data.hasResults) {
          try {
            const resultsResponse = await api.simulations.getResults(id);
            if (resultsResponse.success) {
              setSimulationResults(resultsResponse.data);
            }
          } catch (e) {
            console.error('加载模拟结果失败', e);
          }
          
          try {
            const risksResponse = await api.simulations.getRisks(id);
            if (risksResponse.success) {
              setRisks(risksResponse.data);
            }
          } catch (e) {
            console.error('加载风险数据失败', e);
          }
          
          try {
            const eventsResponse = await api.simulations.getEvents(id);
            if (eventsResponse.success) {
              setEvents(eventsResponse.data);
            }
          } catch (e) {
            console.error('加载事件数据失败', e);
          }
        }
      }
    } catch (error) {
      message.error('加载实验详情失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    try {
      setLoading(true);
      const response = await api.simulations.run(id);
      if (response.success) {
        message.success('实验运行完成');
        loadExperiment();
      }
    } catch (error) {
      message.error('运行实验失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      const response = await api.experiments.reset(id);
      if (response.success) {
        message.success('实验已重置');
        loadExperiment();
      }
    } catch (error) {
      message.error('重置实验失败');
      console.error(error);
    }
  };

  const handleDownloadJSON = async () => {
    try {
      const blob = await api.reports.downloadJSON(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `experiment-${id}-report.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('JSON报告下载成功');
    } catch (error) {
      message.error('下载报告失败');
      console.error(error);
    }
  };

  const handleDownloadMarkdown = async () => {
    try {
      const blob = await api.reports.downloadMarkdown(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `experiment-${id}-report.md`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('Markdown报告下载成功');
    } catch (error) {
      message.error('下载报告失败');
      console.error(error);
    }
  };

  const getStatusTag = (status) => {
    switch (status) {
      case 'completed':
        return <Tag color="green">已完成</Tag>;
      case 'running':
        return <Tag color="blue">运行中</Tag>;
      case 'created':
        return <Tag color="orange">已创建</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const eventTypeColors = {
    'read_start': 'blue',
    'write_start': 'orange',
    'delete_start': 'red',
    'l1_hit': 'green',
    'l2_hit': 'cyan',
    'db_hit': 'purple',
    'db_miss': 'magenta',
    'write_through_complete': 'green',
    'write_behind_complete': 'blue',
    'cache_invalidate_complete': 'orange',
    'delete_complete': 'red',
    'mutex_acquired': 'purple',
    'mutex_released': 'cyan',
    'mutex_contention': 'magenta',
    'bloom_filter_rejected': 'red',
    'preheat': 'green',
    'delay_double_delete': 'orange'
  };

  const eventTypeNames = {
    'read_start': '开始读取',
    'write_start': '开始写入',
    'delete_start': '开始删除',
    'l1_hit': 'L1缓存命中',
    'l2_hit': 'L2缓存命中',
    'db_hit': '数据库命中',
    'db_miss': '数据库未命中',
    'write_through_complete': '直写完成',
    'write_behind_complete': '回写完成',
    'cache_invalidate_complete': '缓存失效完成',
    'delete_complete': '删除完成',
    'mutex_acquired': '获取互斥锁',
    'mutex_released': '释放互斥锁',
    'mutex_contention': '互斥锁竞争',
    'bloom_filter_rejected': '布隆过滤器拒绝',
    'preheat': '缓存预热',
    'delay_double_delete': '延迟双删'
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!experiment) {
    return (
      <Card>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/experiments')}>
          返回实验列表
        </Button>
        <div style={{ textAlign: 'center', marginTop: 50 }}>
          <p>实验不存在</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card 
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/experiments')}>
              返回
            </Button>
            <span>{experiment.name}</span>
            {getStatusTag(experiment.status)}
          </Space>
        }
        extra={
          <Space>
            {experiment.status !== 'running' && (
              <Button 
                type="primary" 
                icon={<PlayCircleOutlined />}
                onClick={handleRun}
                loading={loading}
              >
                运行实验
              </Button>
            )}
            {experiment.status === 'completed' && (
              <>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
                <Button icon={<DownloadOutlined />} onClick={handleDownloadJSON}>
                  下载JSON
                </Button>
                <Button icon={<FileTextOutlined />} onClick={handleDownloadMarkdown}>
                  下载Markdown
                </Button>
                <Button 
                  type="primary" 
                  icon={<BarChartOutlined />}
                  onClick={() => navigate(`/results/${id}`)}
                >
                  详细分析
                </Button>
              </>
            )}
          </Space>
        }
      >
        <Descriptions bordered column={4}>
          <Descriptions.Item label="实验ID">{experiment.id}</Descriptions.Item>
          <Descriptions.Item label="状态">{getStatusTag(experiment.status)}</Descriptions.Item>
          <Descriptions.Item label="缓存策略">{experiment.config.strategy}</Descriptions.Item>
          <Descriptions.Item label="写入策略">{experiment.config.writeStrategy}</Descriptions.Item>
          
          <Descriptions.Item label="L1容量">{experiment.config.l1Capacity}</Descriptions.Item>
          <Descriptions.Item label="L1 TTL">{experiment.config.l1Ttl}秒</Descriptions.Item>
          <Descriptions.Item label="L2容量">{experiment.config.l2Capacity}</Descriptions.Item>
          <Descriptions.Item label="L2 TTL">{experiment.config.l2Ttl}秒</Descriptions.Item>
          
          <Descriptions.Item label="延迟双删">
            {experiment.config.delayDoubleDelete ? '启用' : '禁用'}
          </Descriptions.Item>
          <Descriptions.Item label="互斥锁">
            {experiment.config.useMutex ? '启用' : '禁用'}
          </Descriptions.Item>
          <Descriptions.Item label="布隆过滤器">
            {experiment.config.useBloomFilter ? '启用' : '禁用'}
          </Descriptions.Item>
          <Descriptions.Item label="预热">
            {experiment.config.enablePreheating ? '启用' : '禁用'}
          </Descriptions.Item>
          
          <Descriptions.Item label="创建时间" span={2}>
            {new Date(experiment.createdAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间" span={2}>
            {new Date(experiment.updatedAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {simulationResults && (
        <Card title="模拟结果概览" style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总请求数"
                  value={simulationResults.finalStats?.stats?.totalRequests || 0}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="缓存命中"
                  value={simulationResults.finalStats?.stats?.cacheHits || 0}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="缓存未命中"
                  value={simulationResults.finalStats?.stats?.cacheMisses || 0}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="命中率"
                  value={(simulationResults.finalStats?.stats?.hitRate || 0) * 100}
                  suffix="%"
                  precision={2}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card title="数据源分布">
                <Progress 
                  percent={((simulationResults.finalStats?.stats?.sourceRatio?.l1 || 0) / 
                    ((simulationResults.finalStats?.stats?.totalReads || 1)) * 100)} 
                  status="active"
                  format={() => `L1: ${simulationResults.finalStats?.stats?.sourceRatio?.l1 || 0} 次`}
                />
                <Progress 
                  percent={((simulationResults.finalStats?.stats?.sourceRatio?.l2 || 0) / 
                    ((simulationResults.finalStats?.stats?.totalReads || 1)) * 100)} 
                  status="active"
                  format={() => `L2: ${simulationResults.finalStats?.stats?.sourceRatio?.l2 || 0} 次`}
                />
                <Progress 
                  percent={((simulationResults.finalStats?.stats?.dbReads || 0) / 
                    ((simulationResults.finalStats?.stats?.totalReads || 1)) * 100)} 
                  status="active"
                  format={() => `DB: ${simulationResults.finalStats?.stats?.dbReads || 0} 次`}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="风险检测">
                {risks && (
                  <List>
                    <List.Item>
                      <Space>
                        <span>一致性窗口:</span>
                        <Tag color={risks.consistency?.count > 0 ? 'red' : 'green'}>
                          {risks.consistency?.count || 0} 个
                        </Tag>
                      </Space>
                    </List.Item>
                    <List.Item>
                      <Space>
                        <span>缓存穿透:</span>
                        <Tag color={risks.penetration?.count > 0 ? 'orange' : 'green'}>
                          {risks.penetration?.count || 0} 次
                        </Tag>
                      </Space>
                    </List.Item>
                    <List.Item>
                      <Space>
                        <span>缓存击穿:</span>
                        <Tag color={risks.breakdown?.count > 0 ? 'orange' : 'green'}>
                          {risks.breakdown?.count || 0} 次
                        </Tag>
                      </Space>
                    </List.Item>
                    <List.Item>
                      <Space>
                        <span>缓存雪崩:</span>
                        <Tag color={risks.avalanche?.count > 0 ? 'red' : 'green'}>
                          {risks.avalanche?.count || 0} 次
                        </Tag>
                      </Space>
                    </List.Item>
                  </List>
                )}
              </Card>
            </Col>
          </Row>
        </Card>
      )}

      <Tabs defaultActiveKey="traffic" style={{ marginTop: 16 }}>
        <TabPane tab="流量计划" key="traffic">
          <Card>
            {experiment.trafficPlan && experiment.trafficPlan.length > 0 ? (
              <Table
                dataSource={experiment.trafficPlan}
                rowKey={(record, index) => index}
                columns={[
                  { title: '序号', dataIndex: 'index', key: 'index', render: (_, __, i) => i + 1, width: 60 },
                  { 
                    title: '操作类型', 
                    dataIndex: 'type', 
                    key: 'type',
                    render: (type) => {
                      const colors = { read: 'blue', write: 'green', delete: 'red' };
                      const names = { read: '读取', write: '写入', delete: '删除' };
                      return <Tag color={colors[type]}>{names[type]}</Tag>;
                    }
                  },
                  { title: 'Key', dataIndex: 'key', key: 'key' },
                  { title: 'Value', dataIndex: 'value', key: 'value', render: (v) => v || '-' },
                  { title: '延迟(ms)', dataIndex: 'delayMs', key: 'delayMs' }
                ]}
                pagination={false}
                size="small"
              />
            ) : (
              <p>暂无流量计划</p>
            )}
          </Card>
        </TabPane>

        {simulationResults && (
          <TabPane tab="执行结果" key="results">
            <Card>
              <Table
                dataSource={simulationResults.stepResults}
                rowKey={(record, index) => index}
                columns={[
                  { title: '序号', dataIndex: 'index', key: 'index', render: (_, __, i) => i + 1, width: 60 },
                  { 
                    title: '操作', 
                    render: (_, record) => {
                      const colors = { read: 'blue', write: 'green', delete: 'red' };
                      const names = { read: '读取', write: '写入', delete: '删除' };
                      return <Tag color={colors[record.step?.type]}>{names[record.step?.type]}</Tag>;
                    }
                  },
                  { title: 'Key', dataIndex: ['step', 'key'], key: 'key' },
                  { 
                    title: '结果', 
                    render: (_, record) => {
                      if (record.result?.fromLayer) {
                        const layerColors = { l1: 'green', l2: 'cyan', db: 'purple' };
                        const layerNames = { l1: 'L1缓存', l2: 'L2缓存', db: '数据库' };
                        return (
                          <Space>
                            <Tag color={layerColors[record.result.fromLayer]}>
                              来自 {layerNames[record.result.fromLayer]}
                            </Tag>
                            {record.result.isConsistent === false && (
                              <Tag color="red">不一致</Tag>
                            )}
                          </Space>
                        );
                      }
                      return <Tag>完成</Tag>;
                    }
                  },
                  { title: '执行时间', dataIndex: 'timestamp', key: 'timestamp', 
                    render: (t) => new Date(t).toLocaleTimeString('zh-CN') 
                  }
                ]}
                pagination={{ pageSize: 10 }}
                size="small"
              />
            </Card>
          </TabPane>
        )}

        {events.length > 0 && (
          <TabPane tab="事件时间线" key="events">
            <Card>
              <Timeline mode="left">
                {events.slice(0, 50).map((event, index) => (
                  <Timeline.Item
                    key={event.id || index}
                    color={eventTypeColors[event.type] || 'gray'}
                    label={new Date(event.timestamp).toLocaleTimeString('zh-CN')}
                  >
                    <Space>
                      <Tag color={eventTypeColors[event.type] || 'gray'}>
                        {eventTypeNames[event.type] || event.type}
                      </Tag>
                      {event.details?.key && <span>Key: {event.details.key}</span>}
                      {event.details?.value && <span>Value: {JSON.stringify(event.details.value)}</span>}
                    </Space>
                  </Timeline.Item>
                ))}
              </Timeline>
              {events.length > 50 && (
                <Alert 
                  message={`仅显示前50条事件，共 ${events.length} 条`} 
                  type="info" 
                  showIcon 
                  style={{ marginTop: 16 }}
                />
              )}
            </Card>
          </TabPane>
        )}

        {risks && (
          <TabPane tab="风险详情" key="risks">
            <Card>
              {risks.consistency?.count > 0 ? (
                <div style={{ marginBottom: 24 }}>
                  <Alert
                    message="一致性风险"
                    description={`检测到 ${risks.consistency.count} 个一致性窗口，缓存值与数据库不一致。`}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <Table
                    dataSource={risks.consistency.windows}
                    rowKey={(record, index) => index}
                    columns={[
                      { title: 'Key', dataIndex: 'key', key: 'key' },
                      { title: 'L1不一致', dataIndex: 'l1Inconsistent', key: 'l1Inconsistent', 
                        render: (v) => v ? <Tag color="red">是</Tag> : <Tag color="green">否</Tag> 
                      },
                      { title: 'L2不一致', dataIndex: 'l2Inconsistent', key: 'l2Inconsistent',
                        render: (v) => v ? <Tag color="red">是</Tag> : <Tag color="green">否</Tag> 
                      },
                      { title: 'L1值', dataIndex: 'l1Value', key: 'l1Value', 
                        render: (v) => JSON.stringify(v) 
                      },
                      { title: 'L2值', dataIndex: 'l2Value', key: 'l2Value', 
                        render: (v) => JSON.stringify(v) 
                      },
                      { title: 'DB值', dataIndex: 'dbValue', key: 'dbValue', 
                        render: (v) => JSON.stringify(v) 
                      }
                    ]}
                    size="small"
                    pagination={false}
                  />
                </div>
              ) : (
                <Alert
                  message="无一致性风险"
                  description="缓存与数据库保持一致。"
                  type="success"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              )}

              {risks.penetration?.count > 0 ? (
                <div style={{ marginBottom: 24 }}>
                  <Alert
                    message="缓存穿透风险"
                    description={`检测到 ${risks.penetration.count} 次穿透事件。`}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <List
                    dataSource={risks.penetration.events}
                    renderItem={(item) => (
                      <List.Item>
                        <Space>
                          <Tag color="orange">穿透</Tag>
                          <span>Key: {item.key}</span>
                          <span>原因: {item.reason}</span>
                          <span>时间: {new Date(item.timestamp).toLocaleTimeString('zh-CN')}</span>
                        </Space>
                      </List.Item>
                    )}
                  />
                </div>
              ) : (
                <Alert
                  message="无穿透风险"
                  description="未检测到缓存穿透事件。"
                  type="success"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              )}

              {risks.breakdown?.count > 0 ? (
                <div style={{ marginBottom: 24 }}>
                  <Alert
                    message="缓存击穿风险"
                    description={`检测到 ${risks.breakdown.count} 次击穿事件。`}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <List
                    dataSource={risks.breakdown.events}
                    renderItem={(item) => (
                      <List.Item>
                        <Space>
                          <Tag color="orange">击穿</Tag>
                          <span>Key: {item.key}</span>
                          <span>原因: {item.reason}</span>
                          <span>时间: {new Date(item.timestamp).toLocaleTimeString('zh-CN')}</span>
                        </Space>
                      </List.Item>
                    )}
                  />
                </div>
              ) : (
                <Alert
                  message="无击穿风险"
                  description="未检测到缓存击穿事件。"
                  type="success"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              )}

              {risks.avalanche?.count > 0 ? (
                <div>
                  <Alert
                    message="缓存雪崩风险"
                    description={`检测到 ${risks.avalanche.count} 次雪崩风险事件。`}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  {risks.avalanche.highRiskBuckets && risks.avalanche.highRiskBuckets.length > 0 && (
                    <List
                      dataSource={risks.avalanche.highRiskBuckets}
                      renderItem={(item) => (
                        <List.Item>
                          <Space>
                            <Tag color="red">高风险</Tag>
                            <span>时间桶: {item.bucket}</span>
                            <span>过期key数量: {item.keys}</span>
                            <span>Keys: {item.keyList?.join(', ') || '-'}</span>
                          </Space>
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              ) : (
                <Alert
                  message="无雪崩风险"
                  description="未检测到缓存雪崩风险。建议继续使用TTL抖动策略。"
                  type="success"
                  showIcon
                />
              )}
            </Card>
          </TabPane>
        )}
      </Tabs>
    </div>
  );
};

export default ExperimentDetail;
