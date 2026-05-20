import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Tabs,
  List,
  Timeline,
  Modal,
  Form,
  Input,
  Select,
  message,
  InputNumber,
  Steps,
  Table,
  DatePicker,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DownloadOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { incidentApi } from '../services/api';
import { Incident, statusLabels, severityLabels, actionStatusLabels } from '../types';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const statusFlow = ['detecting', 'verifying', 'fixing', 'monitoring', 'reviewing', 'archived'];

const IncidentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('1');
  const [timelineSummary, setTimelineSummary] = useState<any>(null);

  // Modal states
  const [statusModal, setStatusModal] = useState(false);
  const [timelineModal, setTimelineModal] = useState(false);
  const [evidenceModal, setEvidenceModal] = useState(false);
  const [interfaceModal, setInterfaceModal] = useState(false);
  const [actionModal, setActionModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [compensationModal, setCompensationModal] = useState(false);
  const [failureModal, setFailureModal] = useState(false);

  const [form] = Form.useForm();

  const fetchIncident = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await incidentApi.getById(id);
      setIncident(res.data);
    } catch (error) {
      message.error('获取事故详情失败');
    }
    setLoading(false);
  };

  const fetchTimelineSummary = async () => {
    if (!id) return;
    try {
      const res = await incidentApi.getTimelineSummary(id);
      setTimelineSummary(res.data);
    } catch (error) {
      console.error('获取时间线汇总失败');
    }
  };

  useEffect(() => {
    fetchIncident();
    fetchTimelineSummary();
  }, [id]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'gold';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  const getNextStatus = (current: string) => {
    const idx = statusFlow.indexOf(current);
    if (idx < statusFlow.length - 1) {
      return statusFlow[idx + 1];
    }
    return null;
  };

  const handleStatusUpdate = async (values: any) => {
    if (!id || !incident) return;
    try {
      const res = await incidentApi.updateStatus(id, values.newStatus, values.operator, values.reason);
      setIncident(res.data);
      message.success('状态更新成功');
      setStatusModal(false);
      form.resetFields();
      fetchTimelineSummary();
    } catch (error: any) {
      message.error(error.response?.data?.error || '状态更新失败');
    }
  };

  const handleAddTimeline = async (values: any) => {
    if (!id) return;
    try {
      const res = await incidentApi.addTimeline(id, {
        ...values,
        timestamp: values.timestamp?.toISOString(),
      });
      setIncident(res.data);
      message.success('添加时间线成功');
      setTimelineModal(false);
      form.resetFields();
      fetchTimelineSummary();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleAddEvidence = async (values: any) => {
    if (!id) return;
    try {
      const res = await incidentApi.addEvidence(id, values);
      setIncident(res.data);
      message.success('添加证据成功');
      setEvidenceModal(false);
      form.resetFields();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleAddInterface = async (values: any) => {
    if (!id) return;
    try {
      const res = await incidentApi.addAffectedInterface(id, values);
      setIncident(res.data);
      message.success('添加影响接口成功');
      setInterfaceModal(false);
      form.resetFields();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleAddActionItem = async (values: any) => {
    if (!id) return;
    try {
      const res = await incidentApi.addActionItem(id, {
        ...values,
        dueDate: values.dueDate?.toISOString(),
      });
      setIncident(res.data);
      message.success('添加行动项成功');
      setActionModal(false);
      form.resetFields();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleUpdateActionItemStatus = async (actionItemId: string, status: string) => {
    if (!id) return;
    try {
      const res = await incidentApi.updateActionItemStatus(id, actionItemId, status, '当前用户');
      setIncident(res.data);
      message.success('状态更新成功');
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleSetReviewConclusion = async (values: any) => {
    if (!id) return;
    try {
      const res = await incidentApi.setReviewConclusion(id, {
        ...values,
        improvementMeasures: values.improvementMeasures?.split('\n').filter(Boolean),
      });
      setIncident(res.data);
      message.success('复盘结论保存成功');
      setReviewModal(false);
      form.resetFields();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleAddCompensation = async (values: any) => {
    if (!id) return;
    try {
      const res = await incidentApi.addCompensation(id, values);
      setIncident(res.data);
      message.success('补偿记录添加成功');
      setCompensationModal(false);
      form.resetFields();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleAddFailureReason = async (values: any) => {
    if (!id) return;
    try {
      const res = await incidentApi.addFailureReason(id, {
        reason: values.reason,
        operator: values.operator,
        category: values.category,
      });
      setIncident(res.data);
      message.success('失败原因添加成功');
      setFailureModal(false);
      form.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.error || '添加失败');
    }
  };

  const handleExport = async () => {
    if (!id) return;
    try {
      const res = await incidentApi.export(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `incident-${incident?.incidentId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  if (!incident) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" tip="加载事故详情中..." />
      </div>
    );
  }

  const nextStatus = getNextStatus(incident.status);

  return (
    <div>
      <Spin spinning={loading} tip="加载中...">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            返回列表
          </Button>
          <h2>{incident.title}</h2>
          <Tag color={getSeverityColor(incident.severity)}>{severityLabels[incident.severity]}</Tag>
          <Tag color="blue">{statusLabels[incident.status]}</Tag>
        </Space>
        <Space>
          {nextStatus && (
            <Button type="primary" onClick={() => {
              setStatusModal(true);
              form.setFieldsValue({ newStatus: nextStatus, operator: '当前用户' });
            }}>
              推进到: {statusLabels[nextStatus]}
            </Button>
          )}
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出Excel
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions title="基本信息" bordered column={3}>
          <Descriptions.Item label="事故ID">{incident.incidentId}</Descriptions.Item>
          <Descriptions.Item label="责任人">{incident.owner}</Descriptions.Item>
          <Descriptions.Item label="发现人">{incident.detectedBy}</Descriptions.Item>
          <Descriptions.Item label="发生时间">{moment(incident.startTime).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="结束时间">
            {incident.endTime ? moment(incident.endTime).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="持续时间">
            {incident.endTime
              ? moment.duration(moment(incident.endTime).diff(moment(incident.startTime))).humanize()
              : '进行中'}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={3}>{incident.description}</Descriptions.Item>
        </Descriptions>
      </Card>

      {timelineSummary && (
        <Card title="阶段耗时汇总" style={{ marginBottom: 16 }}>
          <Steps current={statusFlow.indexOf(incident.status)}>
            {timelineSummary.summary?.map((phase: any) => (
              <Steps.Step
                key={phase.phase}
                title={statusLabels[phase.phase]}
                description={phase.duration ? `${phase.duration} 分钟` : '进行中'}
              />
            ))}
          </Steps>
        </Card>
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="时间线" key="1">
          <Card
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setTimelineModal(true)}>
                添加事件
              </Button>
            }
          >
            <Timeline mode="left">
              {[...incident.timelines].reverse().map((item, idx) => (
                <Timeline.Item
                  key={idx}
                  label={moment(item.timestamp).format('MM-DD HH:mm')}
                >
                  <p><strong>{item.event}</strong> - {item.operator}</p>
                  {item.description && <p style={{ color: '#666' }}>{item.description}</p>}
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </TabPane>

        <TabPane tab="影响范围" key="2">
          <Card
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setInterfaceModal(true)}>
                添加影响接口
              </Button>
            }
          >
            <List
              dataSource={incident.affectedInterfaces}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item.name}</span>
                        {item.method && <Tag color="blue">{item.method}</Tag>}
                        {item.path && <span style={{ color: '#666' }}>{item.path}</span>}
                      </Space>
                    }
                    description={
                      <Space>
                        <span>影响数: {item.affectedCount}</span>
                        <span>错误率: {item.errorRate}%</span>
                        <span>客户影响: {item.customerImpact}</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
            {incident.affectedInterfaces.length === 0 && (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无影响接口</div>
            )}
          </Card>
        </TabPane>

        <TabPane tab="证据链" key="3">
          <Card
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setEvidenceModal(true)}>
                添加证据
              </Button>
            }
          >
            <List
              dataSource={incident.evidences}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<LinkOutlined />}
                    title={
                      <Space>
                        <Tag>{item.type === 'log' ? '日志' : item.type === 'screenshot' ? '截图' : item.type === 'document' ? '文档' : '链接'}</Tag>
                        <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                      </Space>
                    }
                    description={
                      <Space>
                        <span>上传人: {item.uploadedBy}</span>
                        {item.description && <span>{item.description}</span>}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
            {incident.evidences.length === 0 && (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无证据</div>
            )}
          </Card>
        </TabPane>

        <TabPane tab="行动项" key="4">
          <Card
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setActionModal(true)}>
                添加行动项
              </Button>
            }
          >
            <Table
              dataSource={incident.actionItems}
              rowKey="_id"
              pagination={false}
            >
              <Table.Column title="标题" dataIndex="title" />
              <Table.Column title="负责人" dataIndex="assignee" width={100} />
              <Table.Column
                title="优先级"
                dataIndex="priority"
                width={80}
                render={(p) => (
                  <Tag color={p === 'high' ? 'red' : p === 'medium' ? 'orange' : 'green'}>
                    {p === 'high' ? '高' : p === 'medium' ? '中' : '低'}
                  </Tag>
                )}
              />
              <Table.Column
                title="状态"
                dataIndex="status"
                width={120}
                render={(status, record: any) => (
                  <Select
                    value={status}
                    style={{ width: 100 }}
                    onChange={(v) => handleUpdateActionItemStatus(record._id, v)}
                  >
                    {Object.entries(actionStatusLabels).map(([key, label]) => (
                      <Option key={key} value={key}>{label}</Option>
                    ))}
                  </Select>
                )}
              />
              <Table.Column
                title="截止时间"
                dataIndex="dueDate"
                width={120}
                render={(d) => d ? moment(d).format('YYYY-MM-DD') : '-'}
              />
            </Table>
            {incident.actionItems.length === 0 && (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无行动项</div>
            )}
          </Card>
        </TabPane>

        <TabPane tab="失败原因追溯" key="5">
          <Card
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setFailureModal(true)}>
                添加失败原因
              </Button>
            }
          >
            <List
              dataSource={incident.failureReasons}
              renderItem={(item, idx) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<PlayCircleOutlined />}
                    title={
                      <Space>
                        <span style={{ fontWeight: 'bold' }}>失败原因 #{idx + 1}</span>
                        <Tag color="blue">{item.category || '未分类'}</Tag>
                        <span style={{ color: '#666', fontSize: 12 }}>
                          记录人: {item.operator} | {moment(item.timestamp).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </Space>
                    }
                    description={item.reason}
                  />
                </List.Item>
              )}
            />
            {(!incident.failureReasons || incident.failureReasons.length === 0) && (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无失败原因记录</div>
            )}
          </Card>
        </TabPane>

        <TabPane tab="手动补偿记录" key="6">
          <Card
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCompensationModal(true)}>
                执行手动补偿
              </Button>
            }
          >
            <List
              dataSource={incident.compensationRecords}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    title={
                      <Space>
                        <Tag color="green">{item.type}</Tag>
                        <span>执行人: {item.operator}</span>
                        <span style={{ color: '#666' }}>{moment(item.executedAt).format('YYYY-MM-DD HH:mm')}</span>
                      </Space>
                    }
                    description={
                      <>
                        <p>{item.description}</p>
                        {item.result && <p style={{ color: '#52c41a' }}>执行结果: {item.result}</p>}
                      </>
                    }
                  />
                </List.Item>
              )}
            />
            {incident.compensationRecords.length === 0 && (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无补偿记录</div>
            )}
          </Card>
        </TabPane>

        <TabPane tab="复盘结论" key="7">
          <Card
            extra={
              <Button icon={<PlusOutlined />} onClick={() => {
                setReviewModal(true);
                if (incident.reviewConclusion) {
                  form.setFieldsValue({
                    ...incident.reviewConclusion,
                    improvementMeasures: incident.reviewConclusion.improvementMeasures?.join('\n'),
                  });
                }
              }}>
                {incident.reviewConclusion ? '编辑复盘' : '录入复盘'}
              </Button>
            }
          >
            {incident.reviewConclusion ? (
              <Descriptions bordered column={1}>
                <Descriptions.Item label="根因分析">{incident.reviewConclusion.rootCause}</Descriptions.Item>
                <Descriptions.Item label="影响总结">{incident.reviewConclusion.impactSummary}</Descriptions.Item>
                <Descriptions.Item label="经验教训">{incident.reviewConclusion.lessonsLearned}</Descriptions.Item>
                <Descriptions.Item label="改进措施">
                  {incident.reviewConclusion.improvementMeasures?.map((m, i) => (
                    <div key={i}>• {m}</div>
                  ))}
                </Descriptions.Item>
                <Descriptions.Item label="复盘人">{incident.reviewConclusion.reviewedBy}</Descriptions.Item>
              </Descriptions>
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无复盘结论</div>
            )}
          </Card>
        </TabPane>
      </Tabs>

      {/* Modals */}
      <Modal title="状态变更" open={statusModal} onCancel={() => setStatusModal(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleStatusUpdate}>
          <Form.Item name="newStatus" label="新状态">
            <Select disabled>
              {nextStatus && <Option value={nextStatus}>{statusLabels[nextStatus]}</Option>}
            </Select>
          </Form.Item>
          <Form.Item name="operator" label="操作人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="reason" label="变更原因">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认</Button>
              <Button onClick={() => setStatusModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="添加时间线事件" open={timelineModal} onCancel={() => setTimelineModal(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleAddTimeline}>
          <Form.Item name="timestamp" label="时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="event" label="事件" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="operator" label="操作人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认</Button>
              <Button onClick={() => setTimelineModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="添加证据" open={evidenceModal} onCancel={() => setEvidenceModal(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleAddEvidence}>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select>
              <Option value="log">日志</Option>
              <Option value="screenshot">截图</Option>
              <Option value="document">文档</Option>
              <Option value="link">链接</Option>
            </Select>
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="url" label="链接地址" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="uploadedBy" label="上传人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认</Button>
              <Button onClick={() => setEvidenceModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="添加影响接口" open={interfaceModal} onCancel={() => setInterfaceModal(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleAddInterface}>
          <Form.Item name="name" label="接口名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="method" label="HTTP方法">
            <Select>
              <Option value="GET">GET</Option>
              <Option value="POST">POST</Option>
              <Option value="PUT">PUT</Option>
              <Option value="DELETE">DELETE</Option>
            </Select>
          </Form.Item>
          <Form.Item name="path" label="路径">
            <Input />
          </Form.Item>
          <Form.Item name="affectedCount" label="影响数量">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="errorRate" label="错误率(%)">
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item name="customerImpact" label="客户影响描述" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认</Button>
              <Button onClick={() => setInterfaceModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="添加行动项" open={actionModal} onCancel={() => setActionModal(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleAddActionItem}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="assignee" label="负责人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
            <Select>
              <Option value="high">高</Option>
              <Option value="medium">中</Option>
              <Option value="low">低</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="初始状态" initialValue="pending">
            <Select>
              <Option value="pending">待处理</Option>
              <Option value="in_progress">进行中</Option>
            </Select>
          </Form.Item>
          <Form.Item name="dueDate" label="截止时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认</Button>
              <Button onClick={() => setActionModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="复盘结论" open={reviewModal} onCancel={() => setReviewModal(false)} footer={null} width={700}>
        <Form form={form} layout="vertical" onFinish={handleSetReviewConclusion}>
          <Form.Item name="rootCause" label="根因分析" rules={[{ required: true }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="rootCauseCategory" label="根因分类">
            <Select>
              <Option value="code">代码缺陷</Option>
              <Option value="config">配置错误</Option>
              <Option value="infrastructure">基础设施</Option>
              <Option value="process">流程问题</Option>
              <Option value="human">人为操作</Option>
            </Select>
          </Form.Item>
          <Form.Item name="impactSummary" label="影响总结" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="lessonsLearned" label="经验教训" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="improvementMeasures" label="改进措施（每行一条）">
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="reviewedBy" label="复盘人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认</Button>
              <Button onClick={() => setReviewModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="执行手动补偿" open={compensationModal} onCancel={() => setCompensationModal(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleAddCompensation}>
          <Form.Item name="type" label="补偿类型" rules={[{ required: true }]}>
            <Select>
              <Option value="refund">退款</Option>
              <Option value="retry">重试</Option>
              <Option value="rollback">回滚</Option>
              <Option value="manual">手动修复</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="补偿描述" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="请详细描述补偿操作的内容和范围" />
          </Form.Item>
          <Form.Item name="operator" label="操作人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="result" label="执行结果">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" danger>确认执行补偿</Button>
              <Button onClick={() => setCompensationModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="添加失败原因" open={failureModal} onCancel={() => setFailureModal(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleAddFailureReason}>
          <Form.Item name="reason" label="失败原因描述" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="请详细描述失败的原因，便于后续追溯和分析" />
          </Form.Item>
          <Form.Item name="operator" label="记录人" rules={[{ required: true }]}>
            <Input placeholder="请输入记录人姓名" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select placeholder="请选择分类">
              <Option value="代码缺陷">代码缺陷</Option>
              <Option value="配置错误">配置错误</Option>
              <Option value="网络问题">网络问题</Option>
              <Option value="依赖问题">依赖问题</Option>
              <Option value="人为操作">人为操作</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">确认</Button>
              <Button onClick={() => setFailureModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      </Spin>
    </div>
  );
};

export default IncidentDetail;
