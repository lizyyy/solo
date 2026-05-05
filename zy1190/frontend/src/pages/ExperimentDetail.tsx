import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Statistic, Button, Space, Divider,
  Spin, message, Descriptions, Tag, List, Typography,
  Tabs, Table, Empty, Popconfirm
} from 'antd';
import {
  PlayCircleOutlined, DownloadOutlined, DeleteOutlined,
  ThunderboltOutlined, ClockCircleOutlined, DatabaseOutlined,
  BarChartOutlined, ArrowLeftOutlined, ShareAltOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import {
  getExperiment,
  runExperiment,
  runExperimentAsync,
  getExperimentStatus,
  deleteExperiment,
  exportExperimentMarkdown,
  exportExperimentJson
} from '../services/api';
import type { Experiment, BenchmarkResult } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const ExperimentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [running, setRunning] = useState(false);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (id) {
      loadExperiment();
    }
  }, [id]);

  const loadExperiment = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getExperiment(id);
      setExperiment(data);
    } catch (error) {
      message.error('加载实验失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    if (!id) return;
    setRunning(true);
    try {
      message.info('开始运行实验...');
      await runExperimentAsync(id);
      setPolling(true);
      pollStatus();
    } catch (error) {
      message.error('启动失败');
      setRunning(false);
      console.error(error);
    }
  };

  const pollStatus = async () => {
    if (!id) return;
    const interval = setInterval(async () => {
      const status = await getExperimentStatus(id);
      if (status.status === 'completed' && status.result) {
        clearInterval(interval);
        setPolling(false);
        setRunning(false);
        message.success('实验运行完成');
        loadExperiment();
      } else if (status.status === 'unknown') {
        clearInterval(interval);
        setPolling(false);
        setRunning(false);
        message.error('实验状态异常');
      }
    }, 2000);
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteExperiment(id);
      message.success('删除成功');
      navigate('/experiments');
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  const getHitRate = (result: BenchmarkResult) => {
    const total = result.cache_hits + result.cache_misses;
    if (total === 0) return 0;
    return (result.cache_hits / total) * 100;
  };

  const getLatencyChartOption = (result: BenchmarkResult) => {
    const data = result.latency_timeline || [];
    return {
      tooltip: {
        trigger: 'axis',
        formatter: '{b0}: {c0} ns'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.map((_, i) => `第${i + 1}次`),
        boundaryGap: false
      },
      yAxis: {
        type: 'value',
        name: '延迟 (ns)'
      },
      series: [
        {
          name: '延迟',
          type: 'line',
          data: data,
          smooth: true,
          areaStyle: { opacity: 0.3 }
        }
      ]
    };
  };

  const getCacheChartOption = (result: BenchmarkResult) => {
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        bottom: 0
      },
      series: [
        {
          name: '缓存访问',
          type: 'pie',
          radius: ['40%', '70%'],
          label: {
            show: true,
            formatter: '{b}: {d}%'
          },
          data: [
            { value: result.cache_hits, name: 'Hit', itemStyle: { color: '#52c41a' } },
            { value: result.cache_misses, name: 'Miss', itemStyle: { color: '#ff4d4f' } }
          ]
        }
      ]
    };
  };

  const getThreadConflictChartOption = (result: BenchmarkResult) => {
    const conflicts = result.thread_conflicts || [];
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: conflicts.map((_, i) => `线程 ${i}`)
      },
      yAxis: {
        type: 'value',
        name: '冲突次数'
      },
      series: [
        {
          name: '冲突',
          type: 'bar',
          data: conflicts,
          itemStyle: {
            color: (params: any) => params.value > 0 ? '#fa8c16' : '#d9d9d9'
          }
        }
      ]
    };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!experiment) {
    return (
      <Empty description="实验不存在">
        <Button type="primary" onClick={() => navigate('/experiments')}>
          返回列表
        </Button>
      </Empty>
    );
  }

  const result = experiment.result;

  const configColumns: ColumnsType<{ name: string; value: any }> = [
    { title: '参数', dataIndex: 'name', key: 'name' },
    { title: '值', dataIndex: 'value', key: 'value' }
  ];

  const configData = Object.entries(experiment.config || {}).map(([key, value]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: JSON.stringify(value)
  }));

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/experiments')}>
          返回列表
        </Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  {experiment.name}
                  <Tag style={{ marginLeft: 8 }} color={result ? 'green' : 'orange'}>
                    {result ? '已完成' : '待运行'}
                  </Tag>
                </Title>
                <Text type="secondary" style={{ marginTop: 4 }}>
                  创建时间: {new Date(experiment.created_at).toLocaleString()}
                </Text>
              </div>
              <Space>
                {!result && (
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleRun}
                    loading={running}
                  >
                    {running ? '运行中...' : '运行实验'}
                  </Button>
                )}
                {result && (
                  <>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={() => window.open(exportExperimentMarkdown(id!), '_blank')}
                    >
                      导出 Markdown
                    </Button>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={() => window.open(exportExperimentJson(id!), '_blank')}
                    >
                      导出 JSON
                    </Button>
                  </>
                )}
                <Popconfirm
                  title="确定删除这个实验？"
                  onConfirm={handleDelete}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            </div>

            {experiment.description && (
              <Paragraph style={{ marginTop: 16 }} type="secondary">
                {experiment.description}
              </Paragraph>
            )}
          </Card>
        </Col>

        {result ? (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card className="metric-card">
                <Statistic
                  title="总时间"
                  value={result.total_time_ms}
                  suffix="ms"
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card className="metric-card">
                <Statistic
                  title="吞吐量"
                  value={result.throughput_mbs}
                  precision={2}
                  suffix="MB/s"
                  prefix={<ThunderboltOutlined />}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card className="metric-card">
                <Statistic
                  title="平均延迟"
                  value={result.avg_latency_ns}
                  precision={2}
                  suffix="ns"
                  prefix={<BarChartOutlined />}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card className="metric-card">
                <Statistic
                  title="命中率"
                  value={getHitRate(result)}
                  precision={2}
                  suffix="%"
                  prefix={<DatabaseOutlined />}
                  valueStyle={{ color: getHitRate(result) > 50 ? '#52c41a' : '#ff4d4f' }}
                />
              </Card>
            </Col>

            <Col span={24}>
              <Card title="结果详情">
                <Tabs defaultActiveKey="charts">
                  <TabPane tab="图表分析" key="charts">
                    <Row gutter={[16, 16]}>
                      <Col xs={24} md={12}>
                        <Card title="延迟时间线" size="small">
                          <div className="chart-container">
                            <ReactECharts option={getLatencyChartOption(result)} style={{ height: '100%' }} />
                          </div>
                        </Card>
                      </Col>

                      <Col xs={24} md={12}>
                        <Card title="缓存 Hit/Miss" size="small">
                          <div className="chart-container">
                            <ReactECharts option={getCacheChartOption(result)} style={{ height: '100%' }} />
                          </div>
                        </Card>
                      </Col>

                      {(result.thread_conflicts || []).some(c => c > 0) && (
                        <Col span={24}>
                          <Card title="线程冲突" size="small">
                            <div className="chart-container">
                              <ReactECharts option={getThreadConflictChartOption(result)} style={{ height: '100%' }} />
                            </div>
                          </Card>
                        </Col>
                      )}
                    </Row>
                  </TabPane>

                  <TabPane tab="详细数据" key="details">
                    <Descriptions bordered column={2}>
                      <Descriptions.Item label="测试类型">{result.test_name}</Descriptions.Item>
                      <Descriptions.Item label="总时间">{result.total_time_ms} ms</Descriptions.Item>
                      <Descriptions.Item label="吞吐量">{result.throughput_mbs.toFixed(2)} MB/s</Descriptions.Item>
                      <Descriptions.Item label="平均延迟">{result.avg_latency_ns.toFixed(2)} ns</Descriptions.Item>
                      <Descriptions.Item label="Cache Hits">{result.cache_hits.toLocaleString()}</Descriptions.Item>
                      <Descriptions.Item label="Cache Misses">{result.cache_misses.toLocaleString()}</Descriptions.Item>
                    </Descriptions>
                  </TabPane>

                  {result.metadata && (
                    <TabPane tab="分析与建议" key="analysis">
                      {result.metadata.layout_analysis && (
                        <Card 
                          title="布局分析" 
                          size="small"
                          className={result.metadata.layout_analysis.issue === 'none' ? 'success-card' : 'warning-card'}
                          style={{ marginBottom: 16 }}
                        >
                          <Descriptions column={1}>
                            <Descriptions.Item label="布局类型">
                              {result.metadata.layout_analysis.layout_type === 'bad' ? (
                                <Tag color="red">坏布局 (伪共享)</Tag>
                              ) : result.metadata.layout_analysis.layout_type === 'good' ? (
                                <Tag color="green">好布局 (无伪共享)</Tag>
                              ) : (
                                <Tag color="orange">混合布局</Tag>
                              )}
                            </Descriptions.Item>
                            <Descriptions.Item label="问题">
                              {result.metadata.layout_analysis.issue === 'none' ? (
                                <Text type="success">无问题</Text>
                              ) : (
                                <Text type="warning">{result.metadata.layout_analysis.issue}</Text>
                              )}
                            </Descriptions.Item>
                            {result.metadata.layout_analysis.description && (
                              <Descriptions.Item label="描述">
                                {result.metadata.layout_analysis.description}
                              </Descriptions.Item>
                            )}
                          </Descriptions>
                        </Card>
                      )}

                      {result.metadata.numa_slowdown && (
                        <Card 
                          title="NUMA 延迟分析" 
                          size="small"
                          className="warning-card"
                          style={{ marginBottom: 16 }}
                        >
                          <Descriptions column={2}>
                            <Descriptions.Item label="本地访问时间">
                              {result.metadata.numa_slowdown.local_local_ms.toFixed(2)} ms
                            </Descriptions.Item>
                            <Descriptions.Item label="远端访问时间">
                              {result.metadata.numa_slowdown.local_remote_ms.toFixed(2)} ms
                            </Descriptions.Item>
                            <Descriptions.Item label="慢down因子">
                              <Text type="danger">{result.metadata.numa_slowdown.slowdown_factor.toFixed(2)}x</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="慢down百分比">
                              <Text type="danger">{result.metadata.numa_slowdown.slowdown_percent.toFixed(2)}%</Text>
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>
                      )}

                      {result.metadata.optimization_suggestions && result.metadata.optimization_suggestions.length > 0 && (
                        <Card title="优化建议" size="small" className="optimization-card">
                          <List
                            dataSource={result.metadata.optimization_suggestions}
                            renderItem={(item) => (
                              <List.Item>
                                <Text>💡 {item}</Text>
                              </List.Item>
                            )}
                          />
                        </Card>
                      )}
                    </TabPane>
                  )}
                </Tabs>
              </Card>
            </Col>
          </>
        ) : (
          <Col span={24}>
            <Card>
              <Empty description="此实验尚未运行">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleRun}
                  loading={running}
                >
                  {running ? '运行中...' : '运行实验'}
                </Button>
              </Empty>
            </Card>
          </Col>
        )}

        <Col span={24}>
          <Card title="配置参数">
            <Table
              columns={configColumns}
              dataSource={configData}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ExperimentDetail;
