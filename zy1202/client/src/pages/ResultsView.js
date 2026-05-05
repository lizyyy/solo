import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Spin,
  message,
  Tabs,
  Tag,
  Statistic,
  Row,
  Col,
  Select,
  List,
  Descriptions
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import api from '../api';

const { TabPane } = Tabs;
const { Option } = Select;

const ResultsView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState([]);
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [simulationResults, setSimulationResults] = useState(null);
  const [risks, setRisks] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    loadExperiments();
  }, []);

  useEffect(() => {
    if (id) {
      loadExperimentData(id);
    }
  }, [id]);

  const loadExperiments = async () => {
    try {
      const response = await api.experiments.getAll();
      if (response.success) {
        const exps = response.data || [];
        setExperiments(exps.filter(e => e.hasResults));
      }
    } catch (error) {
      console.error('加载实验列表失败', error);
    }
  };

  const loadExperimentData = async (experimentId) => {
    try {
      setLoading(true);
      
      const expResponse = await api.experiments.getById(experimentId);
      if (expResponse.success) {
        setSelectedExperiment(expResponse.data);
      }
      
      try {
        const resultsResponse = await api.simulations.getResults(experimentId);
        if (resultsResponse.success) {
          setSimulationResults(resultsResponse.data);
        }
      } catch (e) {
        console.error('加载模拟结果失败', e);
      }
      
      try {
        const risksResponse = await api.simulations.getRisks(experimentId);
        if (risksResponse.success) {
          setRisks(risksResponse.data);
        }
      } catch (e) {
        console.error('加载风险数据失败', e);
      }
      
      try {
        const eventsResponse = await api.simulations.getEvents(experimentId);
        if (eventsResponse.success) {
          setEvents(eventsResponse.data);
        }
      } catch (e) {
        console.error('加载事件数据失败', e);
      }
      
    } catch (error) {
      message.error('加载实验数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadJSON = async () => {
    if (!selectedExperiment) return;
    try {
      const blob = await api.reports.downloadJSON(selectedExperiment.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `experiment-${selectedExperiment.id}-report.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('JSON报告下载成功');
    } catch (error) {
      message.error('下载报告失败');
      console.error(error);
    }
  };

  const handleDownloadMarkdown = async () => {
    if (!selectedExperiment) return;
    try {
      const blob = await api.reports.downloadMarkdown(selectedExperiment.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `experiment-${selectedExperiment.id}-report.md`;
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

  return (
    <div>
      <Card 
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/experiments')}>
              返回
            </Button>
            <span>结果分析</span>
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="选择实验"
              style={{ width: 300 }}
              value={selectedExperiment?.id}
              onChange={(val) => {
                navigate(`/results/${val}`);
              }}
              allowClear
            >
              {experiments.map(exp => (
                <Option key={exp.id} value={exp.id}>
                  {exp.name}
                </Option>
              ))}
            </Select>
            {selectedExperiment && (
              <>
                <Button icon={<DownloadOutlined />} onClick={handleDownloadJSON}>
                  下载JSON
                </Button>
                <Button icon={<FileTextOutlined />} onClick={handleDownloadMarkdown}>
                  下载Markdown
                </Button>
              </>
            )}
          </Space>
        }
      >
        <Spin spinning={loading}>
          {!selectedExperiment ? (
            <div style={{ textAlign: 'center', padding: 50 }}>
              <p>请选择一个已完成的实验进行分析</p>
            </div>
          ) : (
            <div>
              <Card 
                title="实验基本信息"
                size="small"
                style={{ marginBottom: 16 }}
              >
                <Descriptions bordered column={4} size="small">
                  <Descriptions.Item label="实验名称">{selectedExperiment.name}</Descriptions.Item>
                  <Descriptions.Item label="状态">{getStatusTag(selectedExperiment.status)}</Descriptions.Item>
                  <Descriptions.Item label="缓存策略">{selectedExperiment.config.strategy}</Descriptions.Item>
                  <Descriptions.Item label="写入策略">{selectedExperiment.config.writeStrategy}</Descriptions.Item>
                  
                  <Descriptions.Item label="延迟双删">
                    {selectedExperiment.config.delayDoubleDelete ? '启用' : '禁用'}
                  </Descriptions.Item>
                  <Descriptions.Item label="互斥锁">
                    {selectedExperiment.config.useMutex ? '启用' : '禁用'}
                  </Descriptions.Item>
                  <Descriptions.Item label="布隆过滤器">
                    {selectedExperiment.config.useBloomFilter ? '启用' : '禁用'}
                  </Descriptions.Item>
                  <Descriptions.Item label="预热">
                    {selectedExperiment.config.enablePreheating ? '启用' : '禁用'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {simulationResults && (
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
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
                        title="命中率"
                        value={(simulationResults.finalStats?.stats?.hitRate || 0) * 100}
                        suffix="%"
                        precision={2}
                        valueStyle={{ color: '#3f8600' }}
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
                        title="回源次数"
                        value={simulationResults.finalStats?.stats?.dbReads || 0}
                        valueStyle={{ color: '#cf1322' }}
                      />
                    </Card>
                  </Col>
                </Row>
              )}

              <Tabs defaultActiveKey="overview">
                <TabPane tab="概览" key="overview">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Card title="性能指标" size="small">
                        {simulationResults && (
                          <List>
                            <List.Item>
                              <Space>
                                <span>总请求数:</span>
                                <Tag>{simulationResults.finalStats?.stats?.totalRequests || 0}</Tag>
                              </Space>
                            </List.Item>
                            <List.Item>
                              <Space>
                                <span>读取请求:</span>
                                <Tag>{simulationResults.finalStats?.stats?.totalReads || 0}</Tag>
                              </Space>
                            </List.Item>
                            <List.Item>
                              <Space>
                                <span>写入请求:</span>
                                <Tag>{simulationResults.finalStats?.stats?.totalWrites || 0}</Tag>
                              </Space>
                            </List.Item>
                            <List.Item>
                              <Space>
                                <span>删除请求:</span>
                                <Tag>{simulationResults.finalStats?.stats?.totalDeletes || 0}</Tag>
                              </Space>
                            </List.Item>
                            <List.Item>
                              <Space>
                                <span>数据库写入:</span>
                                <Tag>{simulationResults.finalStats?.stats?.dbWrites || 0}</Tag>
                              </Space>
                            </List.Item>
                          </List>
                        )}
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card title="风险检测" size="small">
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
                </TabPane>

                <TabPane tab="一致性分析" key="consistency">
                  <Card size="small">
                    {risks?.consistency?.count > 0 ? (
                      <div>
                        <p style={{ color: '#cf1322', marginBottom: 16 }}>
                          检测到 {risks.consistency.count} 个一致性窗口！
                        </p>
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
                      <div style={{ textAlign: 'center', padding: 20 }}>
                        <p>无一致性问题，缓存与数据库保持一致。</p>
                      </div>
                    )}
                  </Card>
                </TabPane>

                <TabPane tab="风险时间线" key="risks">
                  <Card size="small">
                    {risks && (
                      <div>
                        {risks.penetration?.events?.length > 0 && (
                          <div style={{ marginBottom: 24 }}>
                            <h4>穿透事件 ({risks.penetration.events.length} 次)</h4>
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
                        )}
                        
                        {risks.breakdown?.events?.length > 0 && (
                          <div style={{ marginBottom: 24 }}>
                            <h4>击穿事件 ({risks.breakdown.events.length} 次)</h4>
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
                        )}
                        
                        {risks.avalanche?.highRiskBuckets?.length > 0 && (
                          <div>
                            <h4>雪崩风险 ({risks.avalanche.highRiskBuckets.length} 个高风险时间桶)</h4>
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
                          </div>
                        )}
                        
                        {!risks.penetration?.events?.length && 
                         !risks.breakdown?.events?.length && 
                         !risks.avalanche?.highRiskBuckets?.length && (
                          <div style={{ textAlign: 'center', padding: 20 }}>
                            <p>无风险事件记录。</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </TabPane>

                <TabPane tab="执行日志" key="logs">
                  <Card size="small">
                    {simulationResults?.stepResults && (
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
                    )}
                  </Card>
                </TabPane>
              </Tabs>
            </div>
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default ResultsView;
