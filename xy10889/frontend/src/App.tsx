import { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Card, Statistic, Row, Col, Table, Tag, Space, Button, Modal, Form, Input, Select, Timeline, message } from 'antd';
import { 
  DashboardOutlined, 
  ExperimentOutlined, 
  WarningOutlined, 
  ReloadOutlined, 
  EyeOutlined, 
  DownloadOutlined,
  PlusOutlined,
  SyncOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import { sampleApi, exceptionApi, batchApi, Sample as SampleType, ExceptionRecord, Transfer, ResponsibilityLink, Batch as BatchType } from './services/api';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const statusColors: Record<string, string> = {
  CREATED: 'blue',
  COLLECTED: 'cyan',
  IN_TRANSIT: 'orange',
  ARRIVED: 'purple',
  TESTING: 'magenta',
  COMPLETED: 'green',
  EXCEPTION: 'red',
  LOST: 'volcano'
};

const statusLabels: Record<string, string> = {
  CREATED: '已创建',
  COLLECTED: '已采集',
  IN_TRANSIT: '运输中',
  ARRIVED: '已到达',
  TESTING: '检测中',
  COMPLETED: '已完成',
  EXCEPTION: '异常',
  LOST: '已丢失'
};

const exceptionTypeLabels: Record<string, string> = {
  TEMPERATURE_EXCEEDED: '温度超标',
  DELAYED: '延迟',
  DAMAGED: '损坏',
  LOST: '丢失',
  WRONG_DESTINATION: '地址错误',
  OTHER: '其他'
};

const batchStatusColors: Record<string, string> = {
  PREPARING: 'blue',
  SHIPPING: 'orange',
  DELIVERED: 'green',
  EXCEPTION: 'red'
};

const batchStatusLabels: Record<string, string> = {
  PREPARING: '准备中',
  SHIPPING: '运输中',
  DELIVERED: '已送达',
  EXCEPTION: '异常'
};

function App() {
  const [currentMenu, setCurrentMenu] = useState('dashboard');
  const [samples, setSamples] = useState<SampleType[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSample, setSelectedSample] = useState<SampleType | null>(null);
  const [sampleDetailVisible, setSampleDetailVisible] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [responsibility, setResponsibility] = useState<ResponsibilityLink[]>([]);
  const [sampleExceptions, setSampleExceptions] = useState<ExceptionRecord[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [compensateModalVisible, setCompensateModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [resolveExceptionModalVisible, setResolveExceptionModalVisible] = useState(false);
  const [selectedException, setSelectedException] = useState<ExceptionRecord | null>(null);
  const [batches, setBatches] = useState<BatchType[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchType | null>(null);
  const [batchDetailVisible, setBatchDetailVisible] = useState(false);
  const [createBatchModalVisible, setCreateBatchModalVisible] = useState(false);
  const [batchSamples, setBatchSamples] = useState<SampleType[]>([]);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [samplesRes, exceptionsRes, statsRes, batchesRes] = await Promise.all([
        sampleApi.getAll(),
        exceptionApi.getAll(),
        sampleApi.getStatistics(),
        batchApi.getAll()
      ]);
      setSamples(samplesRes.data.data);
      setExceptions(exceptionsRes.data?.data || []);
      setStatistics(statsRes.data.data);
      setBatches(batchesRes.data?.data || []);
    } catch (error) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadSampleDetail = async (sample: SampleType) => {
    setSelectedSample(sample);
    setSampleDetailVisible(true);
    try {
      const [transfersRes, responsibilityRes, exceptionsRes] = await Promise.all([
        sampleApi.getTransfers(sample.id),
        sampleApi.getResponsibility(sample.id),
        sampleApi.getExceptions(sample.id)
      ]);
      setTransfers(transfersRes.data.data);
      setResponsibility(responsibilityRes.data.data);
      setSampleExceptions(exceptionsRes.data.data);
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const handleCreateSample = async (values: any) => {
    try {
      await sampleApi.create({
        ...values,
        currentLocation: values.collectionPoint
      });
      message.success('创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const handleUpdateStatus = async (values: any) => {
    if (!selectedSample) return;
    try {
      await sampleApi.updateStatus(selectedSample.id, values);
      message.success('状态更新成功');
      setStatusModalVisible(false);
      form.resetFields();
      loadData();
      loadSampleDetail(selectedSample);
    } catch (error: any) {
      message.error(error.response?.data?.error || '更新失败');
    }
  };

  const handleTransfer = async (values: any) => {
    if (!selectedSample) return;
    try {
      await sampleApi.transfer(selectedSample.id, {
        ...values,
        fromHandler: selectedSample.currentHandler,
        fromLocation: selectedSample.currentLocation,
        transferTime: new Date().toISOString()
      });
      message.success('交接成功');
      setTransferModalVisible(false);
      form.resetFields();
      loadData();
      loadSampleDetail(selectedSample);
    } catch (error: any) {
      message.error(error.response?.data?.error || '交接失败');
    }
  };

  const handleCompensate = async (values: any) => {
    if (!selectedSample) return;
    try {
      await sampleApi.compensate(selectedSample.id, values);
      message.success('补偿成功');
      setCompensateModalVisible(false);
      form.resetFields();
      loadData();
      loadSampleDetail(selectedSample);
    } catch (error: any) {
      message.error(error.response?.data?.error || '补偿失败');
    }
  };

  const handleResolveException = async (values: any) => {
    if (!selectedException) return;
    try {
      await exceptionApi.resolve(selectedException.id, values);
      message.success('异常已解决');
      setResolveExceptionModalVisible(false);
      form.resetFields();
      loadData();
      if (selectedSample) {
        loadSampleDetail(selectedSample);
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '解决失败');
    }
  };

  const handleExport = (sample: SampleType) => {
    sampleApi.export(sample.id);
    message.success('正在导出，请稍候...');
  };

  const handleCreateBatch = async (values: any) => {
    try {
      await batchApi.create(values);
      message.success('批次创建成功');
      setCreateBatchModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const loadBatchDetail = async (batch: BatchType) => {
    setSelectedBatch(batch);
    setBatchDetailVisible(true);
    try {
      const samplesRes = await batchApi.getSamples(batch.id);
      setBatchSamples(samplesRes.data.data);
    } catch (error) {
      message.error('加载批次详情失败');
    }
  };

  const handleUpdateBatchStatus = async (batchId: string, status: string) => {
    try {
      await batchApi.updateStatus(batchId, { status });
      message.success('批次状态更新成功');
      loadData();
      if (selectedBatch) {
        loadBatchDetail(selectedBatch);
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '更新失败');
    }
  };

  const pieData = statistics ? Object.entries(statistics.byStatus).map(([key, value]) => ({
    name: statusLabels[key] || key,
    value
  })) : [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c43'];

  const sampleColumns = [
    {
      title: '条码',
      dataIndex: 'barcode',
      key: 'barcode',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      )
    },
    {
      title: '当前位置',
      dataIndex: 'currentLocation',
      key: 'currentLocation'
    },
    {
      title: '当前处理人',
      dataIndex: 'currentHandler',
      key: 'currentHandler'
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: SampleType) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => loadSampleDetail(record)}>
            详情
          </Button>
          <Button icon={<DownloadOutlined />} size="small" onClick={() => handleExport(record)}>
            导出
          </Button>
        </Space>
      )
    }
  ];

  const exceptionColumns = [
    {
      title: '样本条码',
      dataIndex: 'sampleId',
      key: 'sampleId',
      render: (id: string) => {
        const sample = samples.find(s => s.id === id);
        return sample ? sample.barcode : '-';
      }
    },
    {
      title: '异常类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color="red">{exceptionTypeLabels[type] || type}</Tag>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '报告人',
      dataIndex: 'reportedBy',
      key: 'reportedBy'
    },
    {
      title: '状态',
      dataIndex: 'resolved',
      key: 'resolved',
      render: (resolved: boolean) => (
        <Tag color={resolved ? 'green' : 'red'}>{resolved ? '已解决' : '未解决'}</Tag>
      )
    },
    {
      title: '报告时间',
      dataIndex: 'reportedAt',
      key: 'reportedAt',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: ExceptionRecord) => (
        <Space>
          {!record.resolved && (
            <Button 
              size="small" 
              type="primary" 
              onClick={() => {
                setSelectedException(record);
                setResolveExceptionModalVisible(true);
              }}
            >
              解决
            </Button>
          )}
          {record.resolved && (
            <Tag color="green">已解决</Tag>
          )}
        </Space>
      )
    }
  ];

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '总览'
    },
    {
      key: 'samples',
      icon: <ExperimentOutlined />,
      label: '样本管理'
    },
    {
      key: 'batches',
      icon: <SyncOutlined />,
      label: '批次管理'
    },
    {
      key: 'exceptions',
      icon: <WarningOutlined />,
      label: '异常管理'
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={200}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#001529' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>样本交接链</Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentMenu]}
          items={menuItems}
          onClick={({ key }) => setCurrentMenu(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: 'white', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <Title level={3} style={{ margin: 0 }}>
            {currentMenu === 'dashboard' ? '控制台总览' : 
             currentMenu === 'samples' ? '样本管理' : 
             currentMenu === 'batches' ? '批次管理' : '异常管理'}
          </Title>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Header>
        <Content style={{ margin: '24px' }}>
          {currentMenu === 'dashboard' && (
            <div>
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="样本总数"
                      value={statistics?.total || 0}
                      prefix={<ExperimentOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="运输中"
                      value={statistics?.byStatus?.IN_TRANSIT || 0}
                      valueStyle={{ color: '#fa8c16' }}
                      prefix={<SyncOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="已完成"
                      value={statistics?.byStatus?.COMPLETED || 0}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="异常"
                      value={(statistics?.byStatus?.EXCEPTION || 0) + (statistics?.byStatus?.LOST || 0)}
                      valueStyle={{ color: '#ff4d4f' }}
                      prefix={<WarningOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Card title="状态分布">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="最近样本">
                    <Table
                      dataSource={samples.slice(0, 5)}
                      columns={sampleColumns.slice(0, 4)}
                      pagination={false}
                      rowKey="id"
                      size="small"
                    />
                  </Card>
                </Col>
              </Row>
            </div>
          )}

          {currentMenu === 'samples' && (
            <div>
              <Card>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                    创建样本
                  </Button>
                </div>
                <Table
                  dataSource={samples}
                  columns={sampleColumns}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            </div>
          )}

          {currentMenu === 'batches' && (
            <div>
              <Card>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateBatchModalVisible(true)}>
                    创建批次
                  </Button>
                </div>
                <Table
                  dataSource={batches}
                  rowKey="id"
                  loading={loading}
                  columns={[
                    { title: '批次号', dataIndex: 'batchNumber', key: 'batchNumber', render: (text: string) => <Text strong>{text}</Text> },
                    { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={batchStatusColors[status]}>{batchStatusLabels[status]}</Tag> },
                    { title: '起点', dataIndex: 'origin', key: 'origin' },
                    { title: '终点', dataIndex: 'destination', key: 'destination' },
                    { title: '承运方', dataIndex: 'courier', key: 'courier' },
                    { title: '样本数', dataIndex: 'sampleCount', key: 'sampleCount' },
                    { title: '预计到达', dataIndex: 'estimatedArrival', key: 'estimatedArrival', render: (time?: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-' },
                    { title: '实际到达', dataIndex: 'actualArrival', key: 'actualArrival', render: (time?: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-' },
                    {
                      title: '操作',
                      key: 'actions',
                      render: (_: any, record: BatchType) => (
                        <Space>
                          <Button size="small" onClick={() => loadBatchDetail(record)}>详情</Button>
                          {record.status === 'PREPARING' && (
                            <Button size="small" type="primary" onClick={() => handleUpdateBatchStatus(record.id, 'SHIPPING')}>
                              发货
                            </Button>
                          )}
                          {record.status === 'SHIPPING' && (
                            <Button size="small" type="primary" onClick={() => handleUpdateBatchStatus(record.id, 'DELIVERED')}>
                              确认送达
                            </Button>
                          )}
                        </Space>
                      )
                    }
                  ]}
                />
              </Card>
            </div>
          )}

          {currentMenu === 'exceptions' && (
            <div>
              <Card>
                <Table
                  dataSource={exceptions}
                  columns={exceptionColumns}
                  rowKey="id"
                  loading={loading}
                />
              </Card>
            </div>
          )}
        </Content>
      </Layout>

      <Modal
        title="创建样本"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSample}>
          <Form.Item name="barcode" label="样本条码" rules={[{ required: true }]}>
            <Input placeholder="例如: SAM007" />
          </Form.Item>
          <Form.Item name="type" label="样本类型" rules={[{ required: true }]}>
            <Select placeholder="请选择样本类型">
              <Option value="血液">血液</Option>
              <Option value="唾液">唾液</Option>
              <Option value="组织">组织</Option>
              <Option value="尿液">尿液</Option>
              <Option value="DNA样本">DNA样本</Option>
            </Select>
          </Form.Item>
          <Form.Item name="collectionPoint" label="采集点" rules={[{ required: true }]}>
            <Input placeholder="例如: 北京采集中心" />
          </Form.Item>
          <Form.Item name="destinationLab" label="目的实验室" rules={[{ required: true }]}>
            <Input placeholder="例如: 北京中心实验室" />
          </Form.Item>
          <Form.Item name="currentHandler" label="当前处理人" rules={[{ required: true }]}>
            <Input placeholder="例如: 张三" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="样本详情"
        open={sampleDetailVisible}
        onCancel={() => setSampleDetailVisible(false)}
        footer={null}
        width={1000}
      >
        {selectedSample && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Text strong>条码:</Text> {selectedSample.barcode}
                </Col>
                <Col span={8}>
                  <Text strong>类型:</Text> {selectedSample.type}
                </Col>
                <Col span={8}>
                  <Text strong>状态:</Text> <Tag color={statusColors[selectedSample.status]}>{statusLabels[selectedSample.status]}</Tag>
                </Col>
                <Col span={8}>
                  <Text strong>采集点:</Text> {selectedSample.collectionPoint}
                </Col>
                <Col span={8}>
                  <Text strong>目的地:</Text> {selectedSample.destinationLab}
                </Col>
                <Col span={8}>
                  <Text strong>当前位置:</Text> {selectedSample.currentLocation}
                </Col>
                <Col span={8}>
                  <Text strong>当前处理人:</Text> {selectedSample.currentHandler}
                </Col>
                <Col span={8}>
                  <Text strong>创建时间:</Text> {dayjs(selectedSample.createdAt).format('YYYY-MM-DD HH:mm')}
                </Col>
              </Row>
              <div style={{ marginTop: 16 }}>
                <Space>
                  <Button onClick={() => setStatusModalVisible(true)}>更新状态</Button>
                  <Button onClick={() => setTransferModalVisible(true)}>交接样本</Button>
                  {(selectedSample.status === 'EXCEPTION' || selectedSample.status === 'LOST') && (
                    <Button type="primary" danger onClick={() => setCompensateModalVisible(true)}>
                      手动补偿
                    </Button>
                  )}
                  <Button onClick={() => handleExport(selectedSample)}>导出链路</Button>
                </Space>
              </div>
            </Card>

            <Row gutter={16}>
              <Col span={12}>
                <Card title="责任链" style={{ marginBottom: 16 }}>
                  <Timeline>
                    {responsibility.map((link) => (
                      <Timeline.Item key={link.id}>
                        <p><Text strong>{link.role}</Text> - {link.handler}</p>
                        <p>{link.action}</p>
                        <p><Text type="secondary">{dayjs(link.startTime).format('YYYY-MM-DD HH:mm')} @ {link.location}</Text></p>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="交接记录" style={{ marginBottom: 16 }}>
                  {transfers.length > 0 ? (
                    <Timeline>
                      {transfers.map((transfer) => (
                        <Timeline.Item key={transfer.id}>
                          <p><Text strong>{transfer.fromHandler}</Text> → <Text strong>{transfer.toHandler}</Text></p>
                          <p>{transfer.fromLocation} → {transfer.toLocation}</p>
                          {transfer.temperature !== undefined && (
                            <p>温度: {transfer.temperature}°C</p>
                          )}
                          <p><Text type="secondary">{dayjs(transfer.transferTime).format('YYYY-MM-DD HH:mm')}</Text></p>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  ) : (
                    <Text type="secondary">暂无交接记录</Text>
                  )}
                </Card>
              </Col>
            </Row>

            {sampleExceptions.length > 0 && (
              <Card title="异常记录">
                {sampleExceptions.map((exception) => (
                  <div key={exception.id} style={{ padding: '12px', background: exception.resolved ? '#f6ffed' : '#fff2f0', marginBottom: 8, borderRadius: 4 }}>
                    <Space style={{ marginBottom: 8 }}>
                      <Tag color={exception.resolved ? 'green' : 'red'}>
                        {exception.resolved ? '已解决' : '未解决'}
                      </Tag>
                      <Tag color="orange">{exceptionTypeLabels[exception.type] || exception.type}</Tag>
                      {!exception.resolved && (
                        <Button 
                          size="small" 
                          type="primary" 
                          onClick={() => {
                            setSelectedException(exception);
                            setResolveExceptionModalVisible(true);
                          }}
                        >
                          解决异常
                        </Button>
                      )}
                    </Space>
                    <p>{exception.description}</p>
                    <p><Text type="secondary">报告人: {exception.reportedBy} @ {dayjs(exception.reportedAt).format('YYYY-MM-DD HH:mm')}</Text></p>
                    {exception.resolved && (
                      <p><Text type="success">解决方案: {exception.resolution} (by {exception.resolvedBy})</Text></p>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="更新状态"
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdateStatus}>
          <Form.Item name="newStatus" label="新状态" rules={[{ required: true }]}>
            <Select placeholder="请选择新状态">
              {Object.entries(statusLabels).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="handler" label="处理人" rules={[{ required: true }]}>
            <Input placeholder="处理人姓名" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="可选备注信息" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              更新
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="交接样本"
        open={transferModalVisible}
        onCancel={() => setTransferModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleTransfer}>
          {selectedSample && (
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <p><Text strong>当前处理人:</Text> {selectedSample.currentHandler}</p>
              <p><Text strong>当前位置:</Text> {selectedSample.currentLocation}</p>
            </div>
          )}
          <Form.Item name="toHandler" label="接收人" rules={[{ required: true }]}>
            <Input placeholder="接收人姓名" />
          </Form.Item>
          <Form.Item name="toLocation" label="接收位置" rules={[{ required: true }]}>
            <Input placeholder="接收位置" />
          </Form.Item>
          <Form.Item name="temperature" label="温度(°C)">
            <Input type="number" placeholder="交接时温度" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认交接
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="手动补偿"
        open={compensateModalVisible}
        onCancel={() => setCompensateModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCompensate}>
          <Form.Item name="newStatus" label="恢复至状态" rules={[{ required: true }]}>
            <Select placeholder="请选择要恢复的状态">
              <Option value="COLLECTED">已采集</Option>
              <Option value="IN_TRANSIT">运输中</Option>
              <Option value="ARRIVED">已到达</Option>
              <Option value="TESTING">检测中</Option>
              <Option value="COMPLETED">已完成</Option>
            </Select>
          </Form.Item>
          <Form.Item name="handler" label="操作人" rules={[{ required: true }]}>
            <Input placeholder="操作人姓名" />
          </Form.Item>
          <Form.Item name="notes" label="补偿说明" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="请详细说明补偿原因和措施" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" danger htmlType="submit" block>
              确认补偿
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="解决异常"
        open={resolveExceptionModalVisible}
        onCancel={() => setResolveExceptionModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleResolveException}>
          {selectedException && (
            <div style={{ marginBottom: 16, padding: 12, background: '#fff2f0', borderRadius: 4 }}>
              <p><Text strong>异常类型:</Text> {exceptionTypeLabels[selectedException.type] || selectedException.type}</p>
              <p><Text strong>描述:</Text> {selectedException.description}</p>
              <p><Text strong>报告人:</Text> {selectedException.reportedBy}</p>
            </div>
          )}
          <Form.Item name="resolvedBy" label="处理人" rules={[{ required: true }]}>
            <Input placeholder="处理人姓名" />
          </Form.Item>
          <Form.Item name="resolution" label="解决方案" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="请详细说明解决方案" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认解决
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="创建批次"
        open={createBatchModalVisible}
        onCancel={() => setCreateBatchModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateBatch}>
          <Form.Item name="batchNumber" label="批次号" rules={[{ required: true }]}>
            <Input placeholder="例如: BATCH2024001" />
          </Form.Item>
          <Form.Item name="origin" label="起点" rules={[{ required: true }]}>
            <Input placeholder="例如: 北京采集中心" />
          </Form.Item>
          <Form.Item name="destination" label="终点" rules={[{ required: true }]}>
            <Input placeholder="例如: 北京中心实验室" />
          </Form.Item>
          <Form.Item name="courier" label="承运方" rules={[{ required: true }]}>
            <Input placeholder="例如: 顺丰冷链" />
          </Form.Item>
          <Form.Item name="estimatedArrival" label="预计到达时间">
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建批次
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批次详情"
        open={batchDetailVisible}
        onCancel={() => setBatchDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedBatch && (
          <div>
            <Card title="批次信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Text strong>批次号:</Text> {selectedBatch.batchNumber}
                </Col>
                <Col span={8}>
                  <Text strong>状态:</Text> <Tag color={batchStatusColors[selectedBatch.status]}>{batchStatusLabels[selectedBatch.status]}</Tag>
                </Col>
                <Col span={8}>
                  <Text strong>样本数:</Text> {selectedBatch.sampleCount}
                </Col>
                <Col span={8}>
                  <Text strong>起点:</Text> {selectedBatch.origin}
                </Col>
                <Col span={8}>
                  <Text strong>终点:</Text> {selectedBatch.destination}
                </Col>
                <Col span={8}>
                  <Text strong>承运方:</Text> {selectedBatch.courier}
                </Col>
              </Row>
              <div style={{ marginTop: 16 }}>
                <Space>
                  {selectedBatch.status === 'PREPARING' && (
                    <Button type="primary" onClick={() => handleUpdateBatchStatus(selectedBatch.id, 'SHIPPING')}>
                      发货
                    </Button>
                  )}
                  {selectedBatch.status === 'SHIPPING' && (
                    <Button type="primary" onClick={() => handleUpdateBatchStatus(selectedBatch.id, 'DELIVERED')}>
                      确认送达
                    </Button>
                  )}
                </Space>
              </div>
            </Card>

            <Card title="批次样本">
              {batchSamples.length > 0 ? (
                <Table
                  dataSource={batchSamples}
                  rowKey="id"
                  size="small"
                  columns={[
                    { title: '条码', dataIndex: 'barcode', key: 'barcode' },
                    { title: '类型', dataIndex: 'type', key: 'type' },
                    { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={statusColors[status]}>{statusLabels[status]}</Tag> },
                    { title: '当前处理人', dataIndex: 'currentHandler', key: 'currentHandler' },
                  ]}
                  pagination={false}
                />
              ) : (
                <Text type="secondary">暂无样本</Text>
              )}
            </Card>
          </div>
        )}
      </Modal>
    </Layout>
  );
}

export default App;
