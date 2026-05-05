import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Spin,
  message,
  Button,
  Space,
  Descriptions,
  Tabs,
  Divider,
  Steps,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { testBatchesAPI, monitoringAPI, analysisAPI, reportsAPI } from '../services/api';

const { TabPane } = Tabs;
const { Step } = Steps;

function BatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState(null);
  const [results, setResults] = useState([]);
  const [monitoringData, setMonitoringData] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [rawAnalysis, setRawAnalysis] = useState(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [batchRes, resultsRes, monitoringRes, assessmentRes] = await Promise.all([
        testBatchesAPI.getById(id),
        testBatchesAPI.getResults(id),
        monitoringAPI.getByBatch(id),
        analysisAPI.getAssessment(id).catch(() => ({ data: { data: null } })),
      ]);

      setBatch(batchRes.data.data);
      setResults(resultsRes.data.data);
      setMonitoringData(monitoringRes.data.data);
      setAssessment(assessmentRes.data.data);
    } catch (error) {
      message.error('加载数据失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const runAssessment = async () => {
    try {
      setLoading(true);
      const res = await analysisAPI.assess(id);
      setAssessment(res.data.data);
      setRawAnalysis(res.data.data.raw_analysis);
      message.success('容量评估完成');
    } catch (error) {
      message.error('评估失败');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format) => {
    try {
      let res;
      if (format === 'markdown') {
        res = await reportsAPI.getMarkdown(id);
        const blob = new Blob([res.data], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `load-test-report-${batch?.batch_number || id}.md`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        res = await reportsAPI.getJSON(id);
        const blob = new Blob([res.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `load-test-report-${batch?.batch_number || id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const totalRequests = results.reduce((sum, r) => sum + (r.total_requests || 0), 0);
  const totalSuccess = results.reduce((sum, r) => sum + (r.success_count || 0), 0);
  const totalFailed = results.reduce((sum, r) => sum + (r.failed_count || 0), 0);
  const totalQps = results.reduce((sum, r) => sum + (r.qps || 0), 0);
  const avgResponseTime = results.length > 0 
    ? results.reduce((sum, r) => sum + (r.avg_response_time || 0), 0) / results.length 
    : 0;
  const overallErrorRate = totalRequests > 0 ? ((totalFailed / totalRequests) * 100).toFixed(2) : 0;

  const getErrorRateColor = (rate) => {
    if (rate >= 20) return 'error';
    if (rate >= 5) return 'warning';
    return 'success';
  };

  const getResponseTimeColor = (p95) => {
    if (p95 >= 1000) return 'error';
    if (p95 >= 500) return 'warning';
    return 'success';
  };

  const resultColumns = [
    {
      title: '接口名称',
      dataIndex: 'interface_name',
      key: 'interface_name',
      render: (text, record) => text || `${record.interface_method || '-'} ${record.interface_path || '全局统计'}`,
    },
    {
      title: 'QPS',
      dataIndex: 'qps',
      key: 'qps',
      render: (val) => <Tag color="blue">{val?.toFixed(2) || 0}</Tag>,
      sorter: (a, b) => a.qps - b.qps,
    },
    {
      title: 'TPS',
      dataIndex: 'tps',
      key: 'tps',
      render: (val) => val?.toFixed(2) || 0,
    },
    {
      title: '平均响应时间',
      dataIndex: 'avg_response_time',
      key: 'avg_response_time',
      render: (val) => `${val?.toFixed(2) || 0}ms`,
    },
    {
      title: 'P50',
      dataIndex: 'p50_response_time',
      key: 'p50_response_time',
      render: (val) => `${val || 0}ms`,
    },
    {
      title: 'P75',
      dataIndex: 'p75_response_time',
      key: 'p75_response_time',
      render: (val) => `${val || 0}ms`,
    },
    {
      title: 'P95',
      dataIndex: 'p95_response_time',
      key: 'p95_response_time',
      render: (val) => (
        <Tag color={getResponseTimeColor(val)}>
          {val || 0}ms
        </Tag>
      ),
    },
    {
      title: 'P99',
      dataIndex: 'p99_response_time',
      key: 'p99_response_time',
      render: (val) => (
        <Tag color={val >= 2000 ? 'error' : 'default'}>
          {val || 0}ms
        </Tag>
      ),
    },
    {
      title: '错误率',
      dataIndex: 'error_rate',
      key: 'error_rate',
      render: (val) => (
        <Tag color={getErrorRateColor(val)}>
          {val?.toFixed(2) || 0}%
        </Tag>
      ),
    },
    {
      title: '总请求数',
      dataIndex: 'total_requests',
      key: 'total_requests',
      render: (val) => val?.toLocaleString() || 0,
    },
  ];

  const getMonitoringChartOption = () => {
    const times = monitoringData.map(d => {
      const dt = new Date(d.snapshot_time);
      return dt.toLocaleTimeString();
    });
    
    return {
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['CPU使用率(%)', '内存使用率(%)'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: times,
      },
      yAxis: {
        type: 'value',
        max: 100,
      },
      series: [
        {
          name: 'CPU使用率(%)',
          type: 'line',
          smooth: true,
          data: monitoringData.map(d => d.cpu_usage),
          areaStyle: { opacity: 0.3 },
        },
        {
          name: '内存使用率(%)',
          type: 'line',
          smooth: true,
          data: monitoringData.map(d => d.memory_usage),
          areaStyle: { opacity: 0.3 },
        },
      ],
    };
  };

  const getQpsChartOption = () => {
    const interfaceNames = results.map(r => 
      r.interface_name || (r.interface_path ? `${r.interface_method} ${r.interface_path}` : '全局')
    );
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      legend: {
        data: ['QPS', '平均响应时间(ms)'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: interfaceNames,
        axisLabel: {
          rotate: 30,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: 'QPS',
        },
        {
          type: 'value',
          name: '响应时间(ms)',
          position: 'right',
        },
      ],
      series: [
        {
          name: 'QPS',
          type: 'bar',
          data: results.map(r => r.qps),
        },
        {
          name: '平均响应时间(ms)',
          type: 'line',
          yAxisIndex: 1,
          data: results.map(r => r.avg_response_time),
        },
      ],
    };
  };

  const renderCapacityMeter = (value, label) => {
    const percentage = Math.min(100, Math.max(0, (value || 0) * 100));
    const color = percentage > 90 ? '#ff4d4f' : percentage > 70 ? '#faad14' : '#52c41a';
    
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 500 }}>{label}</span>
          <span style={{ color, fontWeight: 500 }}>{percentage.toFixed(0)}%</span>
        </div>
        <div className="capacity-meter">
          <div 
            className="capacity-meter-fill" 
            style={{ 
              width: `${percentage}%`,
              backgroundColor: color,
            }}
          />
          <div className="capacity-meter-label" style={{ color: percentage > 50 ? '#fff' : '#333' }}>
            {percentage.toFixed(0)}%
          </div>
        </div>
      </div>
    );
  };

  return (
    <Spin spinning={loading}>
      <div>
        <div style={{ marginBottom: 24 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/test-batches')}>
              返回列表
            </Button>
            <Button icon={<BarChartOutlined />} onClick={runAssessment}>
              运行容量评估
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => exportReport('markdown')}>
              导出 Markdown
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => exportReport('json')}>
              导出 JSON
            </Button>
          </Space>
        </div>

        {batch && (
          <Card 
            title={
              <Space>
                <span style={{ fontSize: 20 }}>{batch.name}</span>
                {batch.is_baseline && <Tag color="gold">基线版本</Tag>}
                <Tag>#{batch.batch_number}</Tag>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <Descriptions size="small" column={4}>
              <Descriptions.Item label="开始时间">{batch.start_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{batch.end_time || '-'}</Descriptions.Item>
              <Descriptions.Item label="持续时间">
                {batch.duration_seconds ? (
                  `${Math.floor(batch.duration_seconds / 60)}m ${Math.round(batch.duration_seconds % 60)}s`
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={
                  batch.status === 'completed' ? 'success' : 
                  batch.status === 'running' ? 'processing' : 
                  batch.status === 'failed' ? 'error' : 'default'
                }>
                  {batch.status === 'completed' ? '已完成' : 
                   batch.status === 'running' ? '进行中' : 
                   batch.status === 'failed' ? '失败' : batch.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="流量模型" span={2}>
                {batch.traffic_model_name || '-'}
              </Descriptions.Item>
              {batch.notes && (
                <Descriptions.Item label="备注" span={2}>
                  {batch.notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总 QPS"
                value={totalQps}
                precision={2}
                prefix={<ThunderboltOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均响应时间"
                value={avgResponseTime}
                precision={2}
                suffix="ms"
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: avgResponseTime > 500 ? '#ff4d4f' : '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总请求数"
                value={totalRequests}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="错误率"
                value={parseFloat(overallErrorRate)}
                suffix="%"
                prefix={<CloseCircleOutlined />}
                valueStyle={{ 
                  color: parseFloat(overallErrorRate) >= 5 ? '#ff4d4f' : 
                         parseFloat(overallErrorRate) > 0 ? '#faad14' : '#52c41a' 
                }}
              />
            </Card>
          </Col>
        </Row>

        <Tabs defaultActiveKey="1">
          <TabPane tab="性能指标" key="1">
            <Row gutter={[16, 16]}>
              {results.length > 0 && (
                <Col span={12}>
                  <Card title="接口 QPS 与响应时间对比">
                    <ReactECharts option={getQpsChartOption()} style={{ height: 350 }} />
                  </Card>
                </Col>
              )}
              {monitoringData.length > 0 && (
                <Col span={results.length > 0 ? 12 : 24}>
                  <Card title="系统资源监控趋势">
                    <ReactECharts option={getMonitoringChartOption()} style={{ height: 350 }} />
                  </Card>
                </Col>
              )}
            </Row>

            <Divider />

            <Card title="接口详细数据">
              <Table
                columns={resultColumns}
                dataSource={results}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 1200 }}
              />
            </Card>
          </TabPane>

          <TabPane tab="容量评估" key="2">
            {assessment ? (
              <div>
                <Row gutter={[16, 16]}>
                  <Col span={6}>
                    <Card title="容量指标">
                      <div style={{ textAlign: 'center' }}>
                        <Statistic
                          title="最大 QPS"
                          value={assessment.max_qps}
                          precision={2}
                        />
                        <Divider />
                        <Statistic
                          title="安全 QPS"
                          value={assessment.safe_qps}
                          precision={2}
                          valueStyle={{ color: '#52c41a' }}
                        />
                        <Divider />
                        <Statistic
                          title="断点 QPS"
                          value={assessment.breaking_point_qps}
                          precision={2}
                          valueStyle={{ color: '#ff4d4f' }}
                        />
                      </div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card title="容量水位">
                      {renderCapacityMeter(assessment.capacity_water_level, '当前容量水位')}
                      <Alert
                        message={
                          assessment.capacity_water_level > 0.9 
                            ? '系统容量紧张，建议优先优化' 
                            : assessment.capacity_water_level > 0.7 
                            ? '系统负载较高，仍有提升空间' 
                            : '系统运行健康，容量充足'
                        }
                        type={
                          assessment.capacity_water_level > 0.9 
                            ? 'error' 
                            : assessment.capacity_water_level > 0.7 
                            ? 'warning' 
                            : 'success'
                        }
                        showIcon
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="容量评估说明">
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="最大 QPS">
                          当前测试中达到的最高 QPS 值
                        </Descriptions.Item>
                        <Descriptions.Item label="安全 QPS">
                          建议的安全运行 QPS（通常为最大 QPS 的 70%）
                        </Descriptions.Item>
                        <Descriptions.Item label="断点 QPS">
                          预估的系统拐点 QPS，超过后系统可能出现异常
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                </Row>

                {assessment.bottleneck_analysis && (
                  <Card title="瓶颈分析" style={{ marginTop: 16 }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {assessment.bottleneck_analysis}
                    </div>
                  </Card>
                )}

                {assessment.recommendations && (
                  <Card title="优化建议" style={{ marginTop: 16 }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {assessment.recommendations}
                    </div>
                  </Card>
                )}

                {assessment.next_test_plan && (
                  <Card title="下一轮压测方案" style={{ marginTop: 16 }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {assessment.next_test_plan}
                    </div>
                  </Card>
                )}
              </div>
            ) : (
              <Alert
                message="尚未执行容量评估"
                description="点击顶部「运行容量评估」按钮进行分析"
                type="info"
                action={
                  <Button size="small" type="primary" onClick={runAssessment}>
                    立即评估
                  </Button>
                }
              />
            )}
          </TabPane>

          <TabPane tab="监控数据" key="3">
            {monitoringData.length > 0 ? (
              <Card title="监控快照列表">
                <Table
                  dataSource={monitoringData}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  size="small"
                  columns={[
                    {
                      title: '快照时间',
                      dataIndex: 'snapshot_time',
                      key: 'snapshot_time',
                      width: 180,
                    },
                    {
                      title: 'CPU使用率',
                      dataIndex: 'cpu_usage',
                      key: 'cpu_usage',
                      render: (val) => val !== null ? (
                        <Tag color={val > 90 ? 'error' : val > 70 ? 'warning' : 'success'}>
                          {val.toFixed(1)}%
                        </Tag>
                      ) : '-',
                    },
                    {
                      title: '内存使用率',
                      dataIndex: 'memory_usage',
                      key: 'memory_usage',
                      render: (val) => val !== null ? (
                        <Tag color={val > 95 ? 'error' : val > 85 ? 'warning' : 'success'}>
                          {val.toFixed(1)}%
                        </Tag>
                      ) : '-',
                    },
                    {
                      title: '磁盘使用率',
                      dataIndex: 'disk_usage',
                      key: 'disk_usage',
                      render: (val) => val !== null ? `${val.toFixed(1)}%` : '-',
                    },
                    {
                      title: '网络入站',
                      dataIndex: 'network_in',
                      key: 'network_in',
                      render: (val) => val !== null ? val : '-',
                    },
                    {
                      title: '网络出站',
                      dataIndex: 'network_out',
                      key: 'network_out',
                      render: (val) => val !== null ? val : '-',
                    },
                    {
                      title: '数据库连接数',
                      dataIndex: 'db_connection_count',
                      key: 'db_connection_count',
                      render: (val) => val ?? '-',
                    },
                  ]}
                />
              </Card>
            ) : (
              <Alert
                message="暂无监控数据"
                description="请先导入监控快照数据"
                type="info"
              />
            )}
          </TabPane>
        </Tabs>
      </div>
    </Spin>
  );
}

export default BatchDetail;
