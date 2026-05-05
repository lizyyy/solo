import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Card,
  Tabs,
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  Upload,
  Table,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Tag,
  Typography,
  Modal,
  List,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import {
  projectApi,
  roofApi,
  obstacleApi,
  panelApi,
  hourlyDataApi,
  layoutApi,
  calculationApi,
  exportApi,
} from '../api';
import { Point, Layout as LayoutType, CalculationResult } from '../types';
import CanvasEditor from '../components/CanvasEditor';

const { Title, Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('basic');
  const [selectedLayout, setSelectedLayout] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [exportFormat, setExportFormat] = useState<'markdown' | 'json'>('markdown');
  const [selectedLayoutsForExport, setSelectedLayoutsForExport] = useState<number[]>([]);

  const projectId = parseInt(id || '0');

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.getById(projectId).then((res) => res.data),
    enabled: !!projectId,
  });

  const { data: roofs } = useQuery({
    queryKey: ['roofs', projectId],
    queryFn: () => roofApi.getByProject(projectId).then((res) => res.data),
    enabled: !!projectId,
  });

  const { data: obstacles } = useQuery({
    queryKey: ['obstacles', projectId],
    queryFn: () => obstacleApi.getByProject(projectId).then((res) => res.data),
    enabled: !!projectId,
  });

  const { data: panels } = useQuery({
    queryKey: ['panels', projectId],
    queryFn: () => panelApi.getByProject(projectId).then((res) => res.data),
    enabled: !!projectId,
  });

  const { data: layouts } = useQuery({
    queryKey: ['layouts', projectId],
    queryFn: () => layoutApi.getByProject(projectId).then((res) => res.data),
    enabled: !!projectId,
  });

  const { data: calculations } = useQuery({
    queryKey: ['calculations', projectId],
    queryFn: () => calculationApi.getByProject(projectId).then((res) => res.data),
    enabled: !!projectId,
  });

  const createRoofMutation = useMutation({
    mutationFn: (data: any) => roofApi.create(data),
    onSuccess: () => {
      message.success('屋顶轮廓保存成功');
      queryClient.invalidateQueries({ queryKey: ['roofs', projectId] });
    },
    onError: () => message.error('屋顶轮廓保存失败'),
  });

  const createObstacleMutation = useMutation({
    mutationFn: (data: any) => obstacleApi.create(data),
    onSuccess: () => {
      message.success('障碍物保存成功');
      queryClient.invalidateQueries({ queryKey: ['obstacles', projectId] });
    },
    onError: () => message.error('障碍物保存失败'),
  });

  const createPanelMutation = useMutation({
    mutationFn: (data: any) => panelApi.create(data),
    onSuccess: () => {
      message.success('组件参数保存成功');
      queryClient.invalidateQueries({ queryKey: ['panels', projectId] });
    },
    onError: () => message.error('组件参数保存失败'),
  });

  const createLayoutMutation = useMutation({
    mutationFn: (data: any) => layoutApi.create(data),
    onSuccess: () => {
      message.success('排布方案保存成功');
      queryClient.invalidateQueries({ queryKey: ['layouts', projectId] });
    },
    onError: () => message.error('排布方案保存失败'),
  });

  const [roofForm] = Form.useForm();
  const [panelForm] = Form.useForm();
  const [layoutForm] = Form.useForm();

  const handleSaveRoof = (coordinates: Point[], area: number) => {
    createRoofMutation.mutate({
      project_id: projectId,
      name: '主屋顶',
      coordinates,
      area,
      inclination: 0,
      azimuth: 0,
    });
  };

  const handleSaveObstacle = (coordinates: Point[], height: number) => {
    createObstacleMutation.mutate({
      project_id: projectId,
      name: `障碍物 ${(obstacles?.length || 0) + 1}`,
      coordinates,
      height,
      type: 'building',
    });
  };

  const handleSavePanel = (values: any) => {
    createPanelMutation.mutate({
      project_id: projectId,
      ...values,
    });
  };

  const handleSaveLayout = (values: any, panelPositions: Array<{ x: number; y: number }>) => {
    const panel = panels?.[0];
    if (!panel) {
      message.error('请先设置组件参数');
      return;
    }

    createLayoutMutation.mutate({
      project_id: projectId,
      name: values.name,
      panel_positions: panelPositions,
      panel_count: panelPositions.length,
      total_power: panelPositions.length * panel.power,
      is_active: values.is_active,
    });
  };

  const handleRunCalculation = async (layoutId: number) => {
    setIsCalculating(true);
    try {
      const res = await calculationApi.run({
        project_id: projectId,
        layout_id: layoutId,
        investment_per_kw: 4.5,
        discount_rate: 0.05,
      });
      message.success('计算完成');
      queryClient.invalidateQueries({ queryKey: ['calculations', projectId] });
    } catch (error) {
      message.error('计算失败');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleExportReport = async () => {
    if (selectedLayoutsForExport.length === 0) {
      message.warning('请选择要导出的方案');
      return;
    }

    try {
      const res = await exportApi.exportReport({
        project_id: projectId,
        layout_ids: selectedLayoutsForExport,
        format: exportFormat,
        include_charts: true,
      });

      const blob = new Blob([res.data], {
        type: exportFormat === 'json' ? 'application/json' : 'text/markdown',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `光伏分析报告_${project?.name || projectId}.${exportFormat === 'json' ? 'json' : 'md'}`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('报告导出成功');
    } catch (error) {
      message.error('报告导出失败');
    }
  };

  const getMonthlyChartOption = (result?: CalculationResult) => {
    if (!result?.monthly_generation && !result?.monthly_revenue) {
      return {};
    }

    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    return {
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['发电量 (kWh)', '收益 (元)'],
      },
      xAxis: {
        type: 'category',
        data: months,
      },
      yAxis: [
        {
          type: 'value',
          name: '发电量 (kWh)',
          position: 'left',
        },
        {
          type: 'value',
          name: '收益 (元)',
          position: 'right',
        },
      ],
      series: [
        {
          name: '发电量 (kWh)',
          type: 'bar',
          data: result?.monthly_generation || [],
          itemStyle: { color: '#1890ff' },
        },
        {
          name: '收益 (元)',
          type: 'line',
          yAxisIndex: 1,
          data: result?.monthly_revenue || [],
          itemStyle: { color: '#52c41a' },
        },
      ],
    };
  };

  const getRiskSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  if (projectLoading) {
    return <div>加载中...</div>;
  }

  if (!project) {
    return <Alert message="项目不存在" type="error" />;
  }

  const tabItems = [
    {
      key: 'basic',
      label: '基本设置',
      children: (
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card title="屋顶轮廓">
              <CanvasEditor
                mode="roof"
                onSave={handleSaveRoof}
                existingPolygons={roofs?.map((r) => r.coordinates) || []}
              />
              {roofs && roofs.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>已保存的屋顶：</Text>
                  <List
                    size="small"
                    dataSource={roofs}
                    renderItem={(item) => (
                      <List.Item>
                        {item.name} - 面积: {item.area.toFixed(2)} ㎡
                      </List.Item>
                    )}
                  />
                </div>
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="障碍物">
              <CanvasEditor
                mode="obstacle"
                onSave={handleSaveObstacle}
                existingPolygons={obstacles?.map((o) => o.coordinates) || []}
              />
              {obstacles && obstacles.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text strong>已保存的障碍物：</Text>
                  <List
                    size="small"
                    dataSource={obstacles}
                    renderItem={(item) => (
                      <List.Item>
                        {item.name} - 高度: {item.height}m
                      </List.Item>
                    )}
                  />
                </div>
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="组件参数">
              <Form
                form={panelForm}
                layout="vertical"
                onFinish={handleSavePanel}
                initialValues={{
                  model: '标准组件',
                  power: 450,
                  efficiency: 0.21,
                  width: 1.65,
                  height: 0.992,
                  temperature_coefficient: -0.38,
                  lifetime: 25,
                  degradation_rate: 0.5,
                }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="model" label="组件型号">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="power" label="功率 (W)" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} min={100} step={10} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="efficiency" label="效率" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} min={0.1} max={1} step={0.01} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="width" label="宽度 (m)" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} min={0.5} step={0.01} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="height" label="高度 (m)" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} min={0.5} step={0.01} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    保存组件参数
                  </Button>
                </Form.Item>
              </Form>
              {panels && panels.length > 0 && (
                <div>
                  <Text strong>已保存的组件：</Text>
                  <List
                    size="small"
                    dataSource={panels}
                    renderItem={(item) => (
                      <List.Item>
                        {item.model} - {item.power}W, {item.efficiency * 100}%
                      </List.Item>
                    )}
                  />
                </div>
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="数据导入">
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">
                  导入逐小时日照和电价数据 (CSV格式，需包含 timestamp, global_irradiance, electricity_price 列)
                </Text>
              </div>
              <Dragger
                accept=".csv"
                showUploadList={false}
                customRequest={async ({ file }) => {
                  try {
                    await hourlyDataApi.importCsv(projectId, file as File);
                    message.success('数据导入成功');
                    queryClient.invalidateQueries({ queryKey: ['hourlyData', projectId] });
                  } catch (error) {
                    message.error('数据导入失败');
                  }
                }}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽 CSV 文件到此处</p>
                <p className="ant-upload-hint">支持 .csv 格式的逐小时数据文件</p>
              </Dragger>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'layout',
      label: '排布方案',
      children: (
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card title="组件排布">
              <CanvasEditor
                mode="layout"
                panel={panels?.[0]}
                onSaveLayout={(positions, values) => handleSaveLayout(values, positions)}
                existingLayouts={layouts || []}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="已保存的方案">
              {layouts && layouts.length > 0 ? (
                <List
                  dataSource={layouts}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          type="link"
                          size="small"
                          onClick={() => setSelectedLayout(item.id)}
                        >
                          查看详情
                        </Button>,
                        <Button
                          type="link"
                          size="small"
                          onClick={() => handleRunCalculation(item.id)}
                          loading={isCalculating}
                        >
                          运行计算
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            {item.name}
                            {item.is_active && <Tag color="green">当前方案</Tag>}
                          </Space>
                        }
                        description={`${item.panel_count} 块组件，总功率 ${(item.total_power / 1000).toFixed(2)} kW`}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Text type="secondary">暂无排布方案，请在左侧画布上绘制</Text>
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'result',
      label: '计算结果',
      children: (
        <div>
          {calculations && calculations.length > 0 ? (
            <div>
              <Card title="方案对比">
                <Row gutter={[16, 16]}>
                  {calculations.map((result) => {
                    const layout = layouts?.find((l) => l.id === result.layout_id);
                    return (
                      <Col span={8} key={result.id}>
                        <Card
                          size="small"
                          hoverable
                          onClick={() => setSelectedLayout(result.layout_id)}
                          style={{
                            borderColor: selectedLayout === result.layout_id ? '#1890ff' : undefined,
                          }}
                        >
                          <Statistic
                            title={layout?.name || '方案'}
                            value={result.annual_generation}
                            suffix="kWh/年"
                            precision={0}
                          />
                          <div style={{ marginTop: 8 }}>
                            <Row>
                              <Col span={12}>
                                <Text type="secondary">收益:</Text>
                                <br />
                                <Text strong>{result.annual_revenue.toFixed(0)} 元</Text>
                              </Col>
                              <Col span={12}>
                                <Text type="secondary">回收期:</Text>
                                <br />
                                <Text strong>{result.payback_period?.toFixed(1) || '-'} 年</Text>
                              </Col>
                            </Row>
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </Card>

              {selectedLayout && calculations.find((c) => c.layout_id === selectedLayout) && (
                <div style={{ marginTop: 16 }}>
                  {(() => {
                    const result = calculations.find((c) => c.layout_id === selectedLayout)!;
                    const layout = layouts?.find((l) => l.id === result.layout_id);
                    return (
                      <Card title={`${layout?.name || '方案'} 详情`}>
                        <Row gutter={[16, 16]}>
                          <Col span={6}>
                            <div className="stat-card">
                              <Statistic
                                title="装机容量"
                                value={result.actual_capacity}
                                suffix="kW"
                                precision={2}
                              />
                            </div>
                          </Col>
                          <Col span={6}>
                            <div className="stat-card">
                              <Statistic
                                title="年发电量"
                                value={result.annual_generation}
                                suffix="kWh"
                                precision={0}
                              />
                            </div>
                          </Col>
                          <Col span={6}>
                            <div className="stat-card">
                              <Statistic
                                title="年收益"
                                value={result.annual_revenue}
                                suffix="元"
                                precision={0}
                              />
                            </div>
                          </Col>
                          <Col span={6}>
                            <div className="stat-card">
                              <Statistic
                                title="投资回收期"
                                value={result.payback_period || 0}
                                suffix="年"
                                precision={1}
                              />
                            </div>
                          </Col>
                        </Row>

                        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                          <Col span={12}>
                            <Card title="月度发电量与收益" size="small">
                              <ReactECharts option={getMonthlyChartOption(result)} style={{ height: 300 }} />
                            </Card>
                          </Col>
                          <Col span={12}>
                            <Card title="遮阴分析" size="small">
                              <Row gutter={16}>
                                <Col span={12}>
                                  <Statistic
                                    title="年遮阴小时数"
                                    value={result.shading_hours}
                                    suffix="小时"
                                    precision={0}
                                  />
                                </Col>
                                <Col span={12}>
                                  <Statistic
                                    title="遮阴损失率"
                                    value={result.shading_loss_ratio * 100}
                                    suffix="%"
                                    precision={1}
                                  />
                                </Col>
                              </Row>
                            </Card>

                            <Card title="风险提示" size="small" style={{ marginTop: 16 }}>
                              {result.risk_factors && result.risk_factors.length > 0 ? (
                                <List
                                  size="small"
                                  dataSource={result.risk_factors}
                                  renderItem={(risk) => (
                                    <List.Item>
                                      <Space>
                                        <Tag color={getRiskSeverityColor(risk.severity)}>
                                          {risk.type}
                                        </Tag>
                                        <Text>{risk.description}</Text>
                                      </Space>
                                    </List.Item>
                                  )}
                                />
                              ) : (
                                <Text type="secondary">暂无风险提示</Text>
                              )}
                            </Card>
                          </Col>
                        </Row>
                      </Card>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <Alert
              message="暂无计算结果"
              description="请先创建排布方案并运行计算"
              type="info"
            />
          )}
        </div>
      ),
    },
    {
      key: 'export',
      label: '报告导出',
      children: (
        <Card title="导出分析报告">
          <div style={{ marginBottom: 16 }}>
            <Text strong>选择要导出的方案：</Text>
          </div>
          <Select
            mode="multiple"
            style={{ width: '100%', marginBottom: 16 }}
            placeholder="请选择方案"
            value={selectedLayoutsForExport}
            onChange={setSelectedLayoutsForExport}
          >
            {layouts?.map((layout) => (
              <Option key={layout.id} value={layout.id}>
                {layout.name} ({layout.panel_count} 块组件)
              </Option>
            ))}
          </Select>

          <div style={{ marginBottom: 16 }}>
            <Text strong>导出格式：</Text>
          </div>
          <Select
            style={{ width: 200, marginBottom: 16 }}
            value={exportFormat}
            onChange={setExportFormat}
          >
            <Option value="markdown">Markdown</Option>
            <Option value="json">JSON</Option>
          </Select>

          <div>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportReport}
              disabled={selectedLayoutsForExport.length === 0}
            >
              导出报告
            </Button>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/projects')}
          style={{ marginRight: 16 }}
        >
          返回列表
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          {project.name}
        </Title>
        {project.location && (
          <Tag style={{ marginLeft: 16 }}>{project.location}</Tag>
        )}
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  );
};

export default ProjectDetail;
