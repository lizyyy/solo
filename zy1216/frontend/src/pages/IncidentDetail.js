import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Descriptions, 
  Tag, 
  Button, 
  Space, 
  Divider, 
  Table, 
  Modal,
  Input,
  Select,
  Tabs,
  List,
  Empty,
  Statistic,
  Row,
  Col,
  message,
  Popconfirm,
  Tooltip
} from 'antd';
import { 
  ArrowLeftOutlined, 
  DownloadOutlined, 
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  LockOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  CodeOutlined,
  FileTextOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter
} from 'recharts';
import { 
  incidentApi, 
  metricApi, 
  downloadFile 
} from '../services/api';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const IncidentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [incident, setIncident] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // 各类数据
  const [cpuHotSpots, setCpuHotSpots] = useState([]);
  const [heapGrowths, setHeapGrowths] = useState([]);
  const [gcPauses, setGcPauses] = useState([]);
  const [lockWaits, setLockWaits] = useState([]);
  const [ioBlocks, setIoBlocks] = useState([]);
  const [networkRtts, setNetworkRtts] = useState([]);
  const [slowRequests, setSlowRequests] = useState([]);
  const [evidenceFragments, setEvidenceFragments] = useState([]);
  
  // 编辑处置建议
  const [editSuggestion, setEditSuggestion] = useState(false);
  const [suggestionValue, setSuggestionValue] = useState('');
  const [editStatus, setEditStatus] = useState(false);
  const [statusValue, setStatusValue] = useState('');

  useEffect(() => {
    if (id) {
      loadAllData();
    }
  }, [id]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [
        incidentRes,
        cpuRes,
        heapRes,
        gcRes,
        lockRes,
        ioRes,
        networkRes,
        slowRes,
        evidenceRes
      ] = await Promise.all([
        incidentApi.getById(id),
        metricApi.getCpuHotSpots(id),
        metricApi.getHeapGrowths(id),
        metricApi.getGcPauses(id),
        metricApi.getLockWaits(id),
        metricApi.getIoBlocks(id),
        metricApi.getNetworkRtts(id),
        metricApi.getSlowRequests(id),
        metricApi.getEvidenceFragments(id)
      ]);

      if (incidentRes.success) setIncident(incidentRes.data);
      if (cpuRes.success) setCpuHotSpots(cpuRes.data || []);
      if (heapRes.success) setHeapGrowths(heapRes.data || []);
      if (gcRes.success) setGcPauses(gcRes.data || []);
      if (lockRes.success) setLockWaits(lockRes.data || []);
      if (ioRes.success) setIoBlocks(ioRes.data || []);
      if (networkRes.success) setNetworkRtts(networkRes.data || []);
      if (slowRes.success) setSlowRequests(slowRes.data || []);
      if (evidenceRes.success) setEvidenceFragments(evidenceRes.data || []);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'red';
      case 'HIGH': return 'orange';
      case 'MEDIUM': return 'gold';
      case 'LOW': return 'blue';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'OPEN': case 'PENDING': return 'red';
      case 'RESOLVED': case 'CLOSED': return 'green';
      case 'ANALYZING': return 'blue';
      default: return 'default';
    }
  };

  // 导出报告
  const handleExport = async (format) => {
    try {
      let response, filename;
      if (format === 'markdown') {
        response = await incidentApi.exportMarkdown(id);
        filename = `incident-${id}-report.md`;
      } else {
        response = await incidentApi.exportJson(id);
        filename = `incident-${id}-report.json`;
      }
      downloadFile(response, filename);
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  // 更新处置建议
  const handleSaveSuggestion = async () => {
    try {
      const response = await incidentApi.updateSuggestion(id, suggestionValue);
      if (response.success) {
        setIncident({ ...incident, suggestion: suggestionValue });
        setEditSuggestion(false);
        message.success('保存成功');
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 更新状态
  const handleSaveStatus = async () => {
    try {
      const response = await incidentApi.update(id, { status: statusValue });
      if (response.success) {
        setIncident({ ...incident, status: statusValue });
        setEditStatus(false);
        message.success('状态更新成功');
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  // 删除事故
  const handleDelete = async () => {
    try {
      const response = await incidentApi.delete(id);
      if (response.success) {
        message.success('删除成功');
        navigate('/incidents');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 准备图表数据
  const prepareGanttData = () => {
    const items = [];
    
    cpuHotSpots.forEach(item => {
      if (item.timestamp) {
        items.push({
          type: 'CPU热点',
          name: item.methodName,
          time: dayjs(item.timestamp).valueOf(),
          value: item.cpuPercent || item.selfTimeMs || 0,
          color: '#ff4d4f'
        });
      }
    });
    
    heapGrowths.forEach(item => {
      if (item.timestamp) {
        items.push({
          type: '堆增长',
          name: item.objectClassName,
          time: dayjs(item.timestamp).valueOf(),
          value: item.heapUsedPercent || item.growthRate || 0,
          color: '#fa8c16'
        });
      }
    });
    
    gcPauses.forEach(item => {
      if (item.timestamp) {
        items.push({
          type: 'GC暂停',
          name: `${item.gcType} - ${item.pauseTimeMs}ms`,
          time: dayjs(item.timestamp).valueOf(),
          value: item.pauseTimeMs || 0,
          color: '#722ed1'
        });
      }
    });
    
    lockWaits.forEach(item => {
      if (item.timestamp) {
        items.push({
          type: '锁等待',
          name: item.lockName,
          time: dayjs(item.timestamp).valueOf(),
          value: item.waitTimeMs || 0,
          color: '#1890ff'
        });
      }
    });
    
    ioBlocks.forEach(item => {
      if (item.timestamp) {
        items.push({
          type: 'IO阻塞',
          name: item.resourcePath,
          time: dayjs(item.timestamp).valueOf(),
          value: item.blockTimeMs || 0,
          color: '#13c2c2'
        });
      }
    });
    
    networkRtts.forEach(item => {
      if (item.timestamp) {
        items.push({
          type: '网络延迟',
          name: `${item.sourceAddress}->${item.destinationAddress}`,
          time: dayjs(item.timestamp).valueOf(),
          value: item.rttAvgMs || 0,
          color: '#52c41a'
        });
      }
    });
    
    slowRequests.forEach(item => {
      if (item.timestamp) {
        items.push({
          type: '慢请求',
          name: `${item.httpMethod} ${item.uri}`,
          time: dayjs(item.timestamp).valueOf(),
          value: item.totalTimeMs || 0,
          color: '#eb2f96'
        });
      }
    });
    
    return items.sort((a, b) => a.time - b.time);
  };

  const prepareBottleneckData = () => {
    const categories = {
      'CPU热点': { count: cpuHotSpots.length, color: '#ff4d4f' },
      '堆增长': { count: heapGrowths.length, color: '#fa8c16' },
      'GC暂停': { count: gcPauses.length, color: '#722ed1' },
      '锁等待': { count: lockWaits.length, color: '#1890ff' },
      'IO阻塞': { count: ioBlocks.length, color: '#13c2c2' },
      '网络延迟': { count: networkRtts.length, color: '#52c41a' },
      '慢请求': { count: slowRequests.length, color: '#eb2f96' }
    };
    
    return Object.entries(categories)
      .filter(([_, v]) => v.count > 0)
      .map(([name, v]) => ({ name, value: v.count, color: v.color }))
      .sort((a, b) => b.value - a.value);
  };

  const ganttData = prepareGanttData();
  const bottleneckData = prepareBottleneckData();

  // CPU热点表格列
  const cpuColumns = [
    { title: '方法名', dataIndex: 'methodName', key: 'methodName', ellipsis: true },
    { title: '类名', dataIndex: 'className', key: 'className', ellipsis: true },
    { title: 'CPU%', dataIndex: 'cpuPercent', key: 'cpuPercent', width: 100, 
      render: v => v ? `${v.toFixed(2)}%` : '-' },
    { title: 'Self Time', dataIndex: 'selfTimeMs', key: 'selfTimeMs', width: 120,
      render: v => v ? `${v}ms` : '-' },
    { title: '线程', dataIndex: 'threadName', key: 'threadName', width: 150, ellipsis: true },
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 160,
      render: t => t ? dayjs(t).format('HH:mm:ss.SSS') : '-' }
  ];

  // GC暂停表格列
  const gcColumns = [
    { title: 'GC类型', dataIndex: 'gcType', key: 'gcType', width: 100 },
    { title: 'GC原因', dataIndex: 'gcCause', key: 'gcCause', ellipsis: true },
    { title: '暂停时间', dataIndex: 'pauseTimeMs', key: 'pauseTimeMs', width: 120,
      render: v => <Tag color={v > 1000 ? 'red' : v > 500 ? 'orange' : 'green'}>{v}ms</Tag> },
    { title: '堆变化', key: 'heap', width: 200,
      render: (_, r) => `${r.heapBeforeMb}MB → ${r.heapAfterMb}MB (${r.heapDeltaMb > 0 ? '+' : ''}${r.heapDeltaMb}MB)` },
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 160,
      render: t => t ? dayjs(t).format('HH:mm:ss.SSS') : '-' }
  ];

  // 慢请求表格列
  const slowReqColumns = [
    { title: '方法', dataIndex: 'httpMethod', key: 'httpMethod', width: 80,
      render: m => <Tag color={m === 'POST' ? 'blue' : 'green'}>{m}</Tag> },
    { title: 'URI', dataIndex: 'uri', key: 'uri', ellipsis: true },
    { title: '状态码', dataIndex: 'statusCode', key: 'statusCode', width: 100,
      render: s => <Tag color={s >= 500 ? 'red' : s >= 400 ? 'orange' : 'green'}>{s}</Tag> },
    { title: '总耗时', dataIndex: 'totalTimeMs', key: 'totalTimeMs', width: 100,
      render: v => `${v}ms` },
    { title: '客户端IP', dataIndex: 'clientIp', key: 'clientIp', width: 130 },
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 160,
      render: t => t ? dayjs(t).format('HH:mm:ss.SSS') : '-' }
  ];

  return (
    <div>
      <Card 
        loading={loading}
        title={
          <Space>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/incidents')}
            />
            <span>{incident?.title || '加载中...'}</span>
            {incident && (
              <Tag color={getSeverityColor(incident.severity)}>
                {incident.severity}
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadAllData}>
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => handleExport('markdown')}>
              导出Markdown
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={() => handleExport('json')}>
              导出JSON
            </Button>
            <Popconfirm
              title="确定要删除这个事故吗？"
              onConfirm={handleDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        {incident && (
          <>
            <Descriptions bordered column={4}>
              <Descriptions.Item label="ID" span={1}>{incident.id}</Descriptions.Item>
              <Descriptions.Item label="标题" span={3}>{incident.title}</Descriptions.Item>
              <Descriptions.Item label="描述" span={4}>{incident.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="严重程度">
                <Tag color={getSeverityColor(incident.severity)}>{incident.severity}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {editStatus ? (
                  <Space>
                    <Select value={statusValue} onChange={setStatusValue} style={{ width: 150 }}>
                      <Option value="OPEN">OPEN</Option>
                      <Option value="PENDING">PENDING</Option>
                      <Option value="ANALYZING">ANALYZING</Option>
                      <Option value="RESOLVED">RESOLVED</Option>
                      <Option value="CLOSED">CLOSED</Option>
                    </Select>
                    <Button size="small" type="primary" onClick={handleSaveStatus}>确定</Button>
                    <Button size="small" onClick={() => setEditStatus(false)}>取消</Button>
                  </Space>
                ) : (
                  <Space>
                    <Tag color={getStatusColor(incident.status)}>{incident.status}</Tag>
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => {
                      setStatusValue(incident.status);
                      setEditStatus(true);
                    }} />
                  </Space>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="事故时间">
                {incident.incidentTime ? dayjs(incident.incidentTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {incident.createdAt ? dayjs(incident.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Card 
              title={
                <Space>
                  <FileTextOutlined />
                  <span>处置建议</span>
                </Space>
              }
              size="small"
              extra={
                !editSuggestion && (
                  <Button 
                    type="text" 
                    icon={<EditOutlined />}
                    onClick={() => {
                      setSuggestionValue(incident.suggestion || '');
                      setEditSuggestion(true);
                    }}
                  >
                    编辑
                  </Button>
                )
              }
            >
              {editSuggestion ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <TextArea 
                    rows={4} 
                    value={suggestionValue} 
                    onChange={(e) => setSuggestionValue(e.target.value)}
                    placeholder="请输入处置建议..."
                  />
                  <Space>
                    <Button type="primary" onClick={handleSaveSuggestion}>保存</Button>
                    <Button onClick={() => setEditSuggestion(false)}>取消</Button>
                  </Space>
                </Space>
              ) : (
                incident.suggestion || <span style={{ color: '#8c8c8c' }}>暂无处置建议</span>
              )}
            </Card>

            <Divider />

            {/* 统计卡片 */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col span={3}>
                <Card size="small">
                  <Statistic title="CPU热点" value={cpuHotSpots.length} prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />} />
                </Card>
              </Col>
              <Col span={3}>
                <Card size="small">
                  <Statistic title="堆增长" value={heapGrowths.length} prefix={<RocketOutlined style={{ color: '#fa8c16' }} />} />
                </Card>
              </Col>
              <Col span={3}>
                <Card size="small">
                  <Statistic title="GC暂停" value={gcPauses.length} prefix={<ClockCircleOutlined style={{ color: '#722ed1' }} />} />
                </Card>
              </Col>
              <Col span={3}>
                <Card size="small">
                  <Statistic title="锁等待" value={lockWaits.length} prefix={<LockOutlined style={{ color: '#1890ff' }} />} />
                </Card>
              </Col>
              <Col span={3}>
                <Card size="small">
                  <Statistic title="IO阻塞" value={ioBlocks.length} prefix={<DatabaseOutlined style={{ color: '#13c2c2' }} />} />
                </Card>
              </Col>
              <Col span={3}>
                <Card size="small">
                  <Statistic title="网络延迟" value={networkRtts.length} prefix={<GlobalOutlined style={{ color: '#52c41a' }} />} />
                </Card>
              </Col>
              <Col span={3}>
                <Card size="small">
                  <Statistic title="慢请求" value={slowRequests.length} prefix={<CodeOutlined style={{ color: '#eb2f96' }} />} />
                </Card>
              </Col>
              <Col span={3}>
                <Card size="small">
                  <Statistic title="证据片段" value={evidenceFragments.length} prefix={<InfoCircleOutlined style={{ color: '#1890ff' }} />} />
                </Card>
              </Col>
            </Row>

            <Tabs activeKey={activeTab} onChange={setActiveTab}>
              <TabPane tab="概览" key="overview">
                <Row gutter={[16, 16]}>
                  <Col span={14}>
                    <Card title="时间线分析" size="small">
                      {ganttData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <ScatterChart data={ganttData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="time" 
                              domain={['auto', 'auto']}
                              tickFormatter={(tick) => dayjs(tick).format('HH:mm:ss')}
                            />
                            <YAxis 
                              dataKey="type" 
                              type="category"
                              data={['CPU热点', '堆增长', 'GC暂停', '锁等待', 'IO阻塞', '网络延迟', '慢请求']}
                            />
                            <RechartsTooltip 
                              formatter={(value, name) => [value, name]}
                              labelFormatter={(label) => dayjs(label).format('YYYY-MM-DD HH:mm:ss.SSS')}
                            />
                            <Legend />
                            <Scatter name="事件" dataKey="value" fill="#8884d8">
                              {ganttData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      ) : (
                        <Empty description="暂无时间线数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Card>
                  </Col>
                  <Col span={10}>
                    <Card title="瓶颈分布" size="small">
                      {bottleneckData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={bottleneckData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {bottleneckData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <Empty description="暂无瓶颈数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Card>
                  </Col>
                </Row>

                {evidenceFragments.length > 0 && (
                  <Card title="关键证据片段" size="small" style={{ marginTop: 16 }}>
                    <List
                      dataSource={evidenceFragments.filter(e => e.isKeyEvidence)}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={
                              <Tag color={
                                item.metricType === 'CPU_HOTSPOT' ? 'red' :
                                item.metricType === 'GC_PAUSE' ? 'purple' :
                                item.metricType === 'LOCK_WAIT' ? 'blue' :
                                'orange'
                              }>{item.metricType}</Tag>
                            }
                            title={
                              <Space>
                                <span>{item.fragmentTitle}</span>
                                {item.isKeyEvidence && <Tag color="red">关键证据</Tag>}
                              </Space>
                            }
                            description={
                              <Space direction="vertical" style={{ width: '100%' }}>
                                <div style={{ color: '#8c8c8c' }}>
                                  来源: {item.sourceFileName || '未知'}
                                  {item.timestamp && ` | 时间: ${dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss')}`}
                                </div>
                                <pre style={{ 
                                  background: '#f5f5f5', 
                                  padding: 8, 
                                  borderRadius: 4,
                                  margin: 0,
                                  maxHeight: 200,
                                  overflow: 'auto'
                                }}>
                                  {item.fragmentContent}
                                </pre>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                )}
              </TabPane>

              <TabPane tab={`CPU热点 (${cpuHotSpots.length})`} key="cpu">
                <Table 
                  columns={cpuColumns} 
                  dataSource={cpuHotSpots} 
                  rowKey="id" 
                  pagination={{ pageSize: 10 }}
                  size="small"
                />
              </TabPane>

              <TabPane tab={`GC暂停 (${gcPauses.length})`} key="gc">
                {gcPauses.length > 0 ? (
                  <>
                    <Card title="GC暂停时间趋势" size="small" style={{ marginBottom: 16 }}>
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={gcPauses.sort((a,b) => dayjs(a.timestamp) - dayjs(b.timestamp))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="timestamp" 
                            tickFormatter={(t) => dayjs(t).format('HH:mm:ss')}
                          />
                          <YAxis label={{ value: '暂停时间(ms)', angle: -90, position: 'insideLeft' }} />
                          <RechartsTooltip 
                            labelFormatter={(t) => dayjs(t).format('YYYY-MM-DD HH:mm:ss.SSS')}
                          />
                          <Area type="monotone" dataKey="pauseTimeMs" stroke="#722ed1" fill="#722ed1" fillOpacity={0.3} name="暂停时间(ms)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Card>
                    <Table 
                      columns={gcColumns} 
                      dataSource={gcPauses} 
                      rowKey="id" 
                      pagination={{ pageSize: 10 }}
                      size="small"
                    />
                  </>
                ) : (
                  <Empty description="暂无GC数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </TabPane>

              <TabPane tab={`慢请求 (${slowRequests.length})`} key="slow">
                {slowRequests.length > 0 ? (
                  <>
                    <Card title="慢请求耗时分布" size="small" style={{ marginBottom: 16 }}>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={slowRequests.sort((a,b) => b.totalTimeMs - a.totalTimeMs).slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="uri" tick={{ fontSize: 10 }} />
                          <YAxis label={{ value: '耗时(ms)', angle: -90, position: 'insideLeft' }} />
                          <RechartsTooltip />
                          <Bar dataKey="totalTimeMs" fill="#eb2f96" name="耗时(ms)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                    <Table 
                      columns={slowReqColumns} 
                      dataSource={slowRequests} 
                      rowKey="id" 
                      pagination={{ pageSize: 10 }}
                      size="small"
                    />
                  </>
                ) : (
                  <Empty description="暂无慢请求数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </TabPane>

              <TabPane tab={`锁等待 (${lockWaits.length})`} key="lock">
                {lockWaits.length > 0 ? (
                  <List
                    dataSource={lockWaits}
                    renderItem={(item) => (
                      <Card size="small" style={{ marginBottom: 8 }}>
                        <Descriptions column={4} size="small">
                          <Descriptions.Item label="锁名" span={2}>{item.lockName}</Descriptions.Item>
                          <Descriptions.Item label="锁类型">{item.lockType}</Descriptions.Item>
                          <Descriptions.Item label="死锁">
                            <Tag color={item.deadlockDetected ? 'red' : 'green'}>
                              {item.deadlockDetected ? '是' : '否'}
                            </Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="等待线程">
                            {item.waitingThreads?.length || 0} 个
                          </Descriptions.Item>
                          <Descriptions.Item label="持有线程">{item.holdingThreadName}</Descriptions.Item>
                          <Descriptions.Item label="等待时间">
                            {item.waitTimeMs ? `${item.waitTimeMs}ms` : '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="时间">
                            {item.timestamp ? dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss') : '-'}
                          </Descriptions.Item>
                        </Descriptions>
                        {item.stackTrace && (
                          <Divider />
                          <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, margin: 0, fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                            {item.stackTrace}
                          </pre>
                        )}
                      </Card>
                    )}
                  />
                ) : (
                  <Empty description="暂无锁等待数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </TabPane>

              <TabPane tab={`IO阻塞 (${ioBlocks.length})`} key="io">
                {ioBlocks.length > 0 ? (
                  <List
                    dataSource={ioBlocks}
                    renderItem={(item) => (
                      <Card size="small" style={{ marginBottom: 8 }}>
                        <Descriptions column={4} size="small">
                          <Descriptions.Item label="IO类型">
                            <Tag>{item.ioType}</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="资源路径" span={2}>{item.resourcePath}</Descriptions.Item>
                          <Descriptions.Item label="阻塞时间">
                            <Tag color={item.blockTimeMs > 1000 ? 'red' : 'orange'}>
                              {item.blockTimeMs}ms
                            </Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="线程">{item.threadName}</Descriptions.Item>
                          <Descriptions.Item label="时间">
                            {item.timestamp ? dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss') : '-'}
                          </Descriptions.Item>
                        </Descriptions>
                        {item.stackTrace && (
                          <>
                            <Divider />
                            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, margin: 0, fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                              {item.stackTrace}
                            </pre>
                          </>
                        )}
                      </Card>
                    )}
                  />
                ) : (
                  <Empty description="暂无IO阻塞数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </TabPane>

              <TabPane tab={`网络延迟 (${networkRtts.length})`} key="network">
                {networkRtts.length > 0 ? (
                  <>
                    <Card title="网络RTT趋势" size="small" style={{ marginBottom: 16 }}>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={networkRtts.sort((a,b) => dayjs(a.timestamp) - dayjs(b.timestamp))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="timestamp" 
                            tickFormatter={(t) => dayjs(t).format('HH:mm:ss')}
                          />
                          <YAxis label={{ value: 'RTT(ms)', angle: -90, position: 'insideLeft' }} />
                          <RechartsTooltip 
                            labelFormatter={(t) => dayjs(t).format('YYYY-MM-DD HH:mm:ss')}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="rttAvgMs" stroke="#52c41a" name="平均RTT" />
                          <Line type="monotone" dataKey="rttMaxMs" stroke="#ff4d4f" name="最大RTT" strokeDasharray="5 5" />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                    <Table 
                      columns={[
                        { title: '源地址', dataIndex: 'sourceAddress', key: 'source' },
                        { title: '目标地址', dataIndex: 'destinationAddress', key: 'dest' },
                        { title: '协议', dataIndex: 'protocol', key: 'protocol', render: p => <Tag>{p}</Tag> },
                        { title: '平均RTT', dataIndex: 'rttAvgMs', key: 'avg', render: v => `${v}ms` },
                        { title: '最大RTT', dataIndex: 'rttMaxMs', key: 'max', render: v => <Tag color={v > 500 ? 'red' : 'default'}>{v}ms</Tag> },
                        { title: '丢包率', dataIndex: 'packetLossPercent', key: 'loss', render: v => <Tag color={v > 5 ? 'red' : v > 1 ? 'orange' : 'green'}>{v}%</Tag> },
                        { title: '时间', dataIndex: 'timestamp', key: 'time', render: t => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-' }
                      ]}
                      dataSource={networkRtts} 
                      rowKey="id" 
                      pagination={{ pageSize: 10 }}
                      size="small"
                    />
                  </>
                ) : (
                  <Empty description="暂无网络延迟数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </TabPane>

              <TabPane tab={`堆内存 (${heapGrowths.length})`} key="heap">
                {heapGrowths.length > 0 ? (
                  <>
                    <Card title="堆内存使用趋势" size="small" style={{ marginBottom: 16 }}>
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={heapGrowths.sort((a,b) => dayjs(a.timestamp) - dayjs(b.timestamp))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="timestamp" 
                            tickFormatter={(t) => dayjs(t).format('HH:mm:ss')}
                          />
                          <YAxis label={{ value: 'MB', angle: -90, position: 'insideLeft' }} />
                          <RechartsTooltip 
                            labelFormatter={(t) => dayjs(t).format('YYYY-MM-DD HH:mm:ss')}
                          />
                          <Legend />
                          <Area type="monotone" dataKey="heapUsedMb" stroke="#fa8c16" fill="#fa8c16" fillOpacity={0.3} name="已使用(MB)" />
                          <Area type="monotone" dataKey="heapMaxMb" stroke="#d9d9d9" fill="#d9d9d9" fillOpacity={0.1} name="最大值(MB)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Card>
                    <Table 
                      columns={[
                        { title: '对象类名', dataIndex: 'objectClassName', key: 'className', ellipsis: true },
                        { title: '实例数', dataIndex: 'instanceCount', key: 'count', render: v => v?.toLocaleString() },
                        { title: '堆使用', dataIndex: 'heapUsedMb', key: 'used', render: v => `${v}MB` },
                        { title: '堆使用率', dataIndex: 'heapUsedPercent', key: 'percent', 
                          render: v => <Tag color={v > 80 ? 'red' : v > 60 ? 'orange' : 'green'}>{v}%</Tag> },
                        { title: '增长率', dataIndex: 'growthRate', key: 'growth', render: v => v ? `${v}%` : '-' },
                        { title: '时间', dataIndex: 'timestamp', key: 'time', render: t => t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-' }
                      ]}
                      dataSource={heapGrowths} 
                      rowKey="id" 
                      pagination={{ pageSize: 10 }}
                      size="small"
                    />
                  </>
                ) : (
                  <Empty description="暂无堆内存数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </TabPane>

              <TabPane tab={`证据片段 (${evidenceFragments.length})`} key="evidence">
                {evidenceFragments.length > 0 ? (
                  <List
                    dataSource={evidenceFragments}
                    renderItem={(item) => (
                      <Card 
                        size="small" 
                        style={{ marginBottom: 8 }}
                        title={
                          <Space>
                            <Tag color={
                              item.metricType === 'CPU_HOTSPOT' ? 'red' :
                              item.metricType === 'HEAP_GROWTH' ? 'orange' :
                              item.metricType === 'GC_PAUSE' ? 'purple' :
                              item.metricType === 'LOCK_WAIT' ? 'blue' :
                              item.metricType === 'IO_BLOCK' ? 'cyan' :
                              item.metricType === 'NETWORK_RTT' ? 'green' :
                              item.metricType === 'SLOW_REQUEST' ? 'magenta' :
                              'default'
                            }>{item.metricType}</Tag>
                            <span>{item.fragmentTitle}</span>
                            {item.isKeyEvidence && <Tag color="red">关键证据</Tag>}
                          </Space>
                        }
                      >
                        <Descriptions column={3} size="small">
                          <Descriptions.Item label="来源文件">
                            {item.sourceFileName || '未知'}
                          </Descriptions.Item>
                          <Descriptions.Item label="时间">
                            {item.timestamp ? dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss') : '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="排序评分">
                            {item.bottleneckScore || '-'}
                          </Descriptions.Item>
                        </Descriptions>
                        <Divider />
                        <pre style={{ 
                          background: '#f5f5f5', 
                          padding: 12, 
                          borderRadius: 4, 
                          margin: 0, 
                          fontSize: 12,
                          maxHeight: 400,
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {item.fragmentContent}
                        </pre>
                      </Card>
                    )}
                  />
                ) : (
                  <Empty description="暂无证据片段数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </TabPane>
            </Tabs>
          </>
        )}
      </Card>
    </div>
  );
};

export default IncidentDetail;
