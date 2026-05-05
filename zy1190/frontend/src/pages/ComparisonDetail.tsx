import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Button, Space, Spin, message, Typography,
  Table, Tag, Empty, Descriptions, Tabs
} from 'antd';
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { getComparison, analyzeComparison, exportComparisonMarkdown } from '../services/api';
import type { Comparison, ComparisonAnalysis, MetricComparison } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const ComparisonDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [analysis, setAnalysis] = useState<ComparisonAnalysis | null>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const compData = await getComparison(id);
      setComparison(compData);

      const analysisData = await analyzeComparison(id);
      if ('error' in analysisData) {
        message.error(analysisData.error as string);
      } else {
        setAnalysis(analysisData as ComparisonAnalysis);
      }
    } catch (error) {
      message.error('加载对比数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getBarChartOption = (metricComparison: MetricComparison) => {
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const data = params[0];
          return `${data.name}<br/>${data.marker} ${metricComparison.metric.replace('_', ' ')}: ${data.value}`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: metricComparison.values.map(v => v.experiment_name),
        axisLabel: { rotate: 30 }
      },
      yAxis: {
        type: 'value',
        name: metricComparison.metric.replace('_', ' ')
      },
      series: [
        {
          name: metricComparison.metric,
          type: 'bar',
          data: metricComparison.values.map(v => v.value),
          itemStyle: {
            color: (params: any) => {
              if (params.dataIndex === 0) return '#1890ff';
              const metric = metricComparison.metric;
              const baseline = metricComparison.baseline_value;
              const current = metricComparison.values[params.dataIndex].value;
              
              if (['total_time_ms', 'avg_latency_ns', 'cache_misses'].includes(metric)) {
                return current < baseline ? '#52c41a' : current > baseline ? '#ff4d4f' : '#1890ff';
              } else {
                return current > baseline ? '#52c41a' : current < baseline ? '#ff4d4f' : '#1890ff';
              }
            }
          }
        }
      ]
    };
  };

  const getChangeChartOption = (metricComparison: MetricComparison) => {
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const data = params[0];
          const change = data.value;
          const sign = change > 0 ? '+' : '';
          return `${data.name}<br/>相对变化: ${sign}${change.toFixed(2)}%`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: metricComparison.values.map(v => v.experiment_name),
        axisLabel: { rotate: 30 }
      },
      yAxis: {
        type: 'value',
        name: '相对变化 (%)'
      },
      series: [
        {
          name: '相对变化',
          type: 'bar',
          data: metricComparison.values.map(v => v.relative_change_pct),
          itemStyle: {
            color: (params: any) => {
              const metric = metricComparison.metric;
              const value = params.value;
              
              if (['total_time_ms', 'avg_latency_ns', 'cache_misses'].includes(metric)) {
                return value < 0 ? '#52c41a' : value > 0 ? '#ff4d4f' : '#d9d9d9';
              } else {
                return value > 0 ? '#52c41a' : value < 0 ? '#ff4d4f' : '#d9d9d9';
              }
            }
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

  if (!comparison) {
    return (
      <Empty description="对比不存在">
        <Button type="primary" onClick={() => navigate('/comparisons')}>
          返回列表
        </Button>
      </Empty>
    );
  }

  const comparisonColumns: ColumnsType<{ metric: string; values: any[] }> = [
    { title: '指标', dataIndex: 'metric', key: 'metric' },
    ...(analysis?.experiments || []).map((exp, idx) => ({
      title: (
        <Space>
          <Text strong>{exp.name}</Text>
          {idx === 0 && <Tag color="blue">基准</Tag>}
        </Space>
      ),
      key: exp.id,
      render: (_: any, record: any) => {
        const metricComp = analysis?.comparisons.find(c => c.metric === record.metric);
        const valueData = metricComp?.values.find(v => v.experiment_id === exp.id);
        if (!valueData) return '-';

        const displayValue = typeof valueData.value === 'number' 
          ? valueData.value.toFixed(valueData.value < 10 ? 4 : 2)
          : valueData.value;

        let cellClass = '';
        let prefix = '';
        
        if (idx !== 0) {
          const metric = record.metric;
          const change = valueData.relative_change_pct;
          
          if (['total_time_ms', 'avg_latency_ns', 'cache_misses'].includes(metric)) {
            if (change < 0) {
              cellClass = 'table-cell-better';
              prefix = '🔻';
            } else if (change > 0) {
              cellClass = 'table-cell-worse';
              prefix = '🔺';
            }
          } else {
            if (change > 0) {
              cellClass = 'table-cell-better';
              prefix = '🔺';
            } else if (change < 0) {
              cellClass = 'table-cell-worse';
              prefix = '🔻';
            }
          }
        }

        return (
          <span className={cellClass}>
            {prefix} {displayValue}
            {idx !== 0 && (
              <span style={{ fontSize: 12, marginLeft: 4, opacity: 0.7 }}>
                ({valueData.relative_change_pct > 0 ? '+' : ''}{valueData.relative_change_pct.toFixed(2)}%)
              </span>
            )}
          </span>
        );
      }
    }))
  ];

  const tableData = (analysis?.comparisons || []).map(c => ({
    metric: c.metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    values: c.values
  }));

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/comparisons')}>
          返回列表
        </Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title level={3} style={{ margin: 0 }}>{comparison.name}</Title>
                <Text type="secondary">
                  创建时间: {new Date(comparison.created_at).toLocaleString()}
                </Text>
              </div>
              {analysis && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(exportComparisonMarkdown(id!), '_blank')}
                >
                  导出 Markdown
                </Button>
              )}
            </div>

            <Descriptions column={3} style={{ marginTop: 16 }}>
              <Descriptions.Item label="实验数量">
                <Tag color="blue">{comparison.experiment_ids.length} 个</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="对比指标">
                {comparison.metrics.length} 项
              </Descriptions.Item>
              {comparison.notes && (
                <Descriptions.Item label="备注">
                  {comparison.notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        {analysis ? (
          <>
            <Col span={24}>
              <Card title="对比分析">
                <Tabs defaultActiveKey="table">
                  <TabPane tab="对比表格" key="table">
                    <Table
                      columns={comparisonColumns}
                      dataSource={tableData}
                      rowKey="metric"
                      pagination={false}
                      bordered
                    />
                  </TabPane>

                  <TabPane tab="图表分析" key="charts">
                    <Row gutter={[16, 16]}>
                      {analysis.comparisons.map((comp) => (
                        <Col xs={24} md={12} key={comp.metric}>
                          <Card 
                            title={comp.metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            size="small"
                          >
                            <div className="chart-container">
                              <ReactECharts 
                                option={getBarChartOption(comp)} 
                                style={{ height: '100%' }} 
                              />
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>

                    <Divider>相对变化（vs 基准）</Divider>

                    <Row gutter={[16, 16]}>
                      {analysis.comparisons.map((comp) => (
                        <Col xs={24} md={12} key={`change-${comp.metric}`}>
                          <Card 
                            title={`${comp.metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - 相对变化`}
                            size="small"
                          >
                            <div className="chart-container">
                              <ReactECharts 
                                option={getChangeChartOption(comp)} 
                                style={{ height: '100%' }} 
                              />
                            </div>
                            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                              <span style={{ marginRight: 16 }}>
                                <span style={{ color: '#52c41a' }}>●</span> 改善
                              </span>
                              <span>
                                <span style={{ color: '#ff4d4f' }}>●</span> 恶化
                              </span>
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </TabPane>

                  <TabPane tab="关键洞察" key="insights">
                    <Card size="small">
                      <div style={{ padding: 16 }}>
                        <Title level={5}>实验对比分析</Title>
                        
                        {analysis.experiments.map((exp, idx) => (
                          <div key={exp.id} style={{ marginBottom: 16 }}>
                            <Text strong>
                              {idx === 0 ? '📊 基准实验: ' : `实验 ${idx + 1}: `}
                              {exp.name}
                            </Text>
                            <br />
                            <Text type="secondary">
                              测试类型: {exp.result?.test_name}
                            </Text>
                          </div>
                        ))}

                        <Divider />

                        <Title level={5}>性能分析</Title>
                        
                        {analysis.comparisons.map((comp) => {
                          const metric = comp.metric;
                          const isLowerBetter = ['total_time_ms', 'avg_latency_ns', 'cache_misses'].includes(metric);
                          
                          const sorted = [...comp.values].sort((a, b) => {
                            if (isLowerBetter) return a.value - b.value;
                            return b.value - a.value;
                          });
                          
                          const best = sorted[0];
                          const worst = sorted[sorted.length - 1];
                          
                          return (
                            <div key={metric} style={{ marginBottom: 16 }}>
                              <Text strong>
                                {metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </Text>
                              <ul>
                                <li>
                                  <Text type="success">
                                    最佳: {best.experiment_name} ({best.value.toFixed(2)})
                                  </Text>
                                </li>
                                <li>
                                  <Text type="danger">
                                    最差: {worst.experiment_name} ({worst.value.toFixed(2)})
                                  </Text>
                                </li>
                              </ul>
                            </div>
                          );
                        })}

                        <Divider />

                        <Title level={5}>优化建议</Title>
                        <ul>
                          <li>基于以上对比，选择性能最佳的配置方案</li>
                          <li>对于伪共享问题，使用 alignas(64) 避免同一缓存行冲突</li>
                          <li>优化内存访问模式，尽量使用顺序访问而非随机访问</li>
                          <li>在 NUMA 架构下，确保线程访问本地 NUMA 节点的内存</li>
                        </ul>
                      </div>
                    </Card>
                  </TabPane>
                </Tabs>
              </Card>
            </Col>
          </>
        ) : (
          <Col span={24}>
            <Card>
              <Empty description="无法进行对比分析，请确保所选实验都已完成运行" />
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default ComparisonDetail;
