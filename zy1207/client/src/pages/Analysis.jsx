import React, { useEffect, useState } from 'react';
import {
  Select,
  Button,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Spin,
  message,
  Descriptions,
  Tabs,
  Alert,
  Steps,
  Divider,
  Space,
} from 'antd';
import { BarChartOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { testBatchesAPI, analysisAPI } from '../services/api';

const { Option } = Select;
const { TabPane } = Tabs;
const { Step } = Steps;

function Analysis() {
  const [loading, setLoading] = useState(false);
  const [allBatches, setAllBatches] = useState([]);
  const [currentBatchId, setCurrentBatchId] = useState(null);
  const [baselineBatchId, setBaselineBatchId] = useState(null);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const res = await testBatchesAPI.getList({ pageSize: 100 });
      setAllBatches(res.data.data);
      
      const sorted = [...res.data.data].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      if (sorted.length > 0) {
        setCurrentBatchId(sorted[0].id);
        
        const baseline = sorted.find(b => b.is_baseline);
        if (baseline && baseline.id !== sorted[0].id) {
          setBaselineBatchId(baseline.id);
        } else if (sorted.length > 1) {
          setBaselineBatchId(sorted[1].id);
        }
      }
    } catch (error) {
      message.error('加载批次列表失败');
    }
  };

  const handleCompare = async () => {
    if (!currentBatchId || !baselineBatchId) {
      message.warning('请选择当前批次和基线批次');
      return;
    }
    
    if (currentBatchId === baselineBatchId) {
      message.warning('当前批次和基线批次不能相同');
      return;
    }
    
    try {
      setLoading(true);
      const res = await analysisAPI.compare(currentBatchId, baselineBatchId);
      setComparison(res.data.data);
    } catch (error) {
      message.error('对比分析失败: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const renderChangeTag = (change, isPositive = true) => {
    const num = parseFloat(change);
    if (isNaN(num) || num === 0) {
      return <Tag>无变化</Tag>;
    }
    
    const isImproved = isPositive ? num > 0 : num < 0;
    const color = isImproved ? 'success' : 'error';
    const prefix = num > 0 ? '+' : '';
    const icon = isImproved ? '↑' : '↓';
    
    return (
      <Tag color={color}>
        {icon} {prefix}{num.toFixed(2)}%
      </Tag>
    );
  };

  const columns = [
    {
      title: '接口名称',
      dataIndex: 'interface_name',
      key: 'interface_name',
      render: (text, record) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{text}</span>
          {record.is_degraded && <Tag color="red">性能下降</Tag>}
          {record.is_improved && <Tag color="green">性能提升</Tag>}
        </Space>
      ),
    },
    {
      title: 'QPS 对比',
      key: 'qps',
      children: [
        {
          title: '基线',
          dataIndex: ['baseline', 'qps'],
          key: 'baseline_qps',
          render: (val) => val?.toFixed(2) || 0,
        },
        {
          title: '当前',
          dataIndex: ['current', 'qps'],
          key: 'current_qps',
          render: (val) => val?.toFixed(2) || 0,
        },
        {
          title: '变化',
          dataIndex: ['changes', 'qps_percent'],
          key: 'qps_change',
          render: (val) => renderChangeTag(val, true),
        },
      ],
    },
    {
      title: '平均响应时间 对比',
      key: 'response_time',
      children: [
        {
          title: '基线',
          dataIndex: ['baseline', 'avg_response_time'],
          key: 'baseline_rt',
          render: (val) => `${val?.toFixed(2) || 0}ms`,
        },
        {
          title: '当前',
          dataIndex: ['current', 'avg_response_time'],
          key: 'current_rt',
          render: (val) => `${val?.toFixed(2) || 0}ms`,
        },
        {
          title: '变化',
          dataIndex: ['changes', 'response_time_percent'],
          key: 'rt_change',
          render: (val) => renderChangeTag(val, false),
        },
      ],
    },
    {
      title: '错误率 对比',
      key: 'error_rate',
      children: [
        {
          title: '基线',
          dataIndex: ['baseline', 'error_rate'],
          key: 'baseline_error',
          render: (val) => <Tag color={val > 5 ? 'error' : 'success'}>{val?.toFixed(2) || 0}%</Tag>,
        },
        {
          title: '当前',
          dataIndex: ['current', 'error_rate'],
          key: 'current_error',
          render: (val) => <Tag color={val > 5 ? 'error' : 'success'}>{val?.toFixed(2) || 0}%</Tag>,
        },
        {
          title: '变化',
          dataIndex: ['changes', 'error_rate_diff'],
          key: 'error_change',
          render: (val) => {
            if (isNaN(val)) return <Tag>-</Tag>;
            const isImproved = val < 0;
            const color = isImproved ? 'success' : val > 2 ? 'error' : 'default';
            const prefix = val > 0 ? '+' : '';
            return (
              <Tag color={color}>
                {val > 0 ? '↑' : '↓'} {prefix}{val.toFixed(2)}%
              </Tag>
            );
          },
        },
      ],
    },
  ];

  const getComparisonChartOption = () => {
    if (!comparison) return {};
    
    const interfaceNames = comparison.interface_comparisons.map(r => r.interface_name);
    
    return {
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['基线 QPS', '当前 QPS'],
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
      yAxis: {
        type: 'value',
        name: 'QPS',
      },
      series: [
        {
          name: '基线 QPS',
          type: 'bar',
          data: comparison.interface_comparisons.map(r => r.baseline?.qps || 0),
        },
        {
          name: '当前 QPS',
          type: 'bar',
          data: comparison.interface_comparisons.map(r => r.current?.qps || 0),
        },
      ],
    };
  };

  const getResponseTimeChartOption = () => {
    if (!comparison) return {};
    
    const interfaceNames = comparison.interface_comparisons.map(r => r.interface_name);
    
    return {
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['基线平均响应时间', '当前平均响应时间'],
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
      yAxis: {
        type: 'value',
        name: '响应时间 (ms)',
      },
      series: [
        {
          name: '基线平均响应时间',
          type: 'bar',
          data: comparison.interface_comparisons.map(r => r.baseline?.avg_response_time || 0),
        },
        {
          name: '当前平均响应时间',
          type: 'bar',
          data: comparison.interface_comparisons.map(r => r.current?.avg_response_time || 0),
        },
      ],
    };
  };

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontWeight: 500 }}>基线版本:</span>
          <Select
            placeholder="选择基线批次"
            style={{ width: 300 }}
            value={baselineBatchId}
            onChange={setBaselineBatchId}
            allowClear
          >
            {allBatches.map(b => (
              <Option key={b.id} value={b.id}>
                {b.name} (#{b.batch_number}){b.is_baseline ? ' [基线]' : ''}
              </Option>
            ))}
          </Select>
          
          <span style={{ fontSize: 24, fontWeight: 'bold' }}>VS</span>
          
          <span style={{ fontWeight: 500 }}>当前版本:</span>
          <Select
            placeholder="选择当前批次"
            style={{ width: 300 }}
            value={currentBatchId}
            onChange={setCurrentBatchId}
            allowClear
          >
            {allBatches.map(b => (
              <Option key={b.id} value={b.id}>
                {b.name} (#{b.batch_number}){b.is_baseline ? ' [基线]' : ''}
              </Option>
            ))}
          </Select>
          
          <Button 
            type="primary" 
            icon={<BarChartOutlined />}
            onClick={handleCompare}
            loading={loading}
          >
            开始对比分析
          </Button>
          
          <Button icon={<ReloadOutlined />} onClick={loadBatches}>
            刷新
          </Button>
        </div>
      </Card>

      <Spin spinning={loading}>
        {comparison ? (
          <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Card title="基线版本信息" size="small">
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="批次名称">
                      {comparison.baseline_batch?.name}
                    </Descriptions.Item>
                    <Descriptions.Item label="批次号">
                      #{comparison.baseline_batch?.batch_number}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {comparison.baseline_batch?.created_at}
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag>{comparison.baseline_batch?.status}</Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="当前版本信息" size="small">
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="批次名称">
                      {comparison.current_batch?.name}
                    </Descriptions.Item>
                    <Descriptions.Item label="批次号">
                      #{comparison.current_batch?.batch_number}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {comparison.current_batch?.created_at}
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag>{comparison.current_batch?.status}</Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>

            {comparison.bottleneck_analysis?.has_bottleneck && (
              <Alert
                message={`检测到 ${comparison.bottleneck_analysis.issues.length} 个潜在性能问题`}
                type="warning"
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}

            <Tabs defaultActiveKey="1">
              <TabPane tab="概览" key="1">
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card title="QPS 对比图">
                      <ReactECharts option={getComparisonChartOption()} style={{ height: 350 }} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="响应时间对比图">
                      <ReactECharts option={getResponseTimeChartOption()} style={{ height: 350 }} />
                    </Card>
                  </Col>
                </Row>

                <Card title="接口对比详情" style={{ marginTop: 16 }}>
                  <Table
                    columns={columns}
                    dataSource={comparison.interface_comparisons}
                    rowKey={(record) => record.interface_name || Math.random().toString()}
                    pagination={false}
                    size="small"
                    rowClassName={(record) => 
                      record.is_degraded ? 'bottleneck-highlight' : ''
                    }
                  />
                </Card>
              </TabPane>

              <TabPane tab="瓶颈分析" key="2">
                {comparison.bottleneck_analysis?.issues?.length > 0 ? (
                  <div>
                    {comparison.bottleneck_analysis.issues.map((issue, idx) => (
                      <Alert
                        key={idx}
                        message={issue.message}
                        type={issue.severity === 'high' ? 'error' : issue.severity === 'medium' ? 'warning' : 'info'}
                        showIcon
                        style={{ marginBottom: 12 }}
                      />
                    ))}
                  </div>
                ) : (
                  <Alert
                    message="未检测到明显的性能瓶颈"
                    description="两个版本的性能表现一致，系统运行状态良好"
                    type="success"
                    showIcon
                  />
                )}

                {comparison.raw_analysis?.recommendations?.length > 0 && (
                  <Card title="优化建议" style={{ marginTop: 24 }}>
                    {comparison.raw_analysis.recommendations.map((cat, idx) => (
                      <div key={idx} style={{ marginBottom: 16 }}>
                        <h4 style={{ marginBottom: 8 }}>{cat.category}</h4>
                        <ol>
                          {cat.items.map((item, itemIdx) => (
                            <li key={itemIdx} style={{ marginBottom: 4 }}>{item}</li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </Card>
                )}
              </TabPane>

              <TabPane tab="下一轮方案" key="3">
                {comparison.raw_analysis?.next_test_plan?.length > 0 ? (
                  <div>
                    <Card title="下一轮压测计划">
                      <Steps
                        direction="vertical"
                        current={0}
                      >
                        {comparison.raw_analysis.next_test_plan.map((step, idx) => (
                          <Step
                            key={idx}
                            title={step.title}
                            description={step.description}
                            icon={
                              step.type === 'fix' ? '🔧' : 
                              step.type === 'validation' ? '✅' : 
                              step.type === 'explore' ? '📈' : '📌'
                            }
                          />
                        ))}
                      </Steps>
                    </Card>

                    {comparison.capacity_metrics && (
                      <Card title="容量指标参考" style={{ marginTop: 24 }}>
                        <Descriptions column={4} bordered size="small">
                          <Descriptions.Item label="最大 QPS">
                            {comparison.capacity_metrics.max_qps}
                          </Descriptions.Item>
                          <Descriptions.Item label="安全 QPS">
                            <Tag color="green">{comparison.capacity_metrics.safe_qps}</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="断点 QPS">
                            <Tag color="red">{comparison.capacity_metrics.breaking_point_qps}</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="容量水位">
                            {(comparison.capacity_metrics.capacity_water_level * 100).toFixed(0)}%
                          </Descriptions.Item>
                        </Descriptions>
                      </Card>
                    )}
                  </div>
                ) : (
                  <Alert
                    message="暂无压测方案建议"
                    description="系统运行稳定，可考虑增加压力进行容量探索"
                    type="info"
                  />
                )}
              </TabPane>
            </Tabs>
          </div>
        ) : (
          <Alert
            message="请选择批次进行对比分析"
            description="选择基线版本和当前版本，然后点击「开始对比分析」"
            type="info"
            showIcon
          />
        )}
      </Spin>
    </div>
  );
}

export default Analysis;
