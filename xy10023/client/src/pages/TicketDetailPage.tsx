import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Tabs,
  List,
  Typography,
  Timeline,
  Alert,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useTicket, useTicketEvents, useUpdateTicket, useChangeTicketStatus, useReplayTicket } from '@/api/tickets.api';
import { useCreateFollowUp, useCompleteFollowUp } from '@/api/followups.api';
import { TicketStatus, TicketPriority, FollowUpType, CreateFollowUpDto, Event, EventType } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

const STATUS_MAP: Record<TicketStatus, { label: string; color: string }> = {
  [TicketStatus.OPEN]: { label: '待处理', color: 'blue' },
  [TicketStatus.IN_PROGRESS]: { label: '处理中', color: 'orange' },
  [TicketStatus.PENDING_FOLLOWUP]: { label: '待跟进', color: 'warning' },
  [TicketStatus.COMPLETED]: { label: '已完成', color: 'success' },
  [TicketStatus.CLOSED]: { label: '已关闭', color: 'default' },
  [TicketStatus.CANCELLED]: { label: '已取消', color: 'error' },
};

const PRIORITY_MAP: Record<TicketPriority, { label: string; color: string }> = {
  [TicketPriority.LOW]: { label: '低', color: 'default' },
  [TicketPriority.NORMAL]: { label: '中', color: 'blue' },
  [TicketPriority.HIGH]: { label: '高', color: 'orange' },
  [TicketPriority.URGENT]: { label: '紧急', color: 'red' },
};

const FOLLOWUP_TYPE_MAP: Record<FollowUpType, string> = {
  [FollowUpType.CALL]: '电话回访',
  [FollowUpType.MESSAGE]: '短信/站内信',
  [FollowUpType.EMAIL]: '邮件',
  [FollowUpType.COMPENSATION]: '补偿处理',
  [FollowUpType.VISIT]: '上门访问',
  [FollowUpType.OTHER]: '其他',
};

const EVENT_TYPE_MAP: Record<EventType, string> = {
  [EventType.TICKET_CREATED]: '工单创建',
  [EventType.TICKET_UPDATED]: '工单更新',
  [EventType.TICKET_STATUS_CHANGED]: '状态变更',
  [EventType.TICKET_ASSIGNED]: '工单分配',
  [EventType.FOLLOW_UP_ADDED]: '添加跟进',
  [EventType.FOLLOW_UP_UPDATED]: '更新跟进',
  [EventType.FOLLOW_UP_COMPLETED]: '完成跟进',
  [EventType.COMPENSATION_APPLIED]: '补偿应用',
  [EventType.STATE_RESTORED]: '状态恢复',
  [EventType.TICKET_DELETED]: '工单删除',
  [EventType.NOTE_ADDED]: '添加备注',
};

export function TicketDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('info');
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isFollowUpModalVisible, setIsFollowUpModalVisible] = useState(false);
  const [isReplayModalVisible, setIsReplayModalVisible] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [editForm] = Form.useForm();
  const [followUpForm] = Form.useForm<CreateFollowUpDto>();

  const { data: ticket, isLoading: ticketLoading, refetch: refetchTicket } = useTicket(id);
  const { data: events = [] } = useTicketEvents(id);
  const updateTicketMutation = useUpdateTicket();
  const changeStatusMutation = useChangeTicketStatus();
  const createFollowUpMutation = useCreateFollowUp();
  const completeFollowUpMutation = useCompleteFollowUp();
  const replayTicketMutation = useReplayTicket();

  const handleUpdateTicket = async (values: any) => {
    if (!ticket) return;

    try {
      await updateTicketMutation.mutateAsync({
        id: ticket.id,
        data: { ...values, version: ticket.version },
      });
      message.success('更新成功');
      setIsEditModalVisible(false);
      editForm.resetFields();
      refetchTicket();
    } catch (error: any) {
      if (error?.response?.status === 409) {
        message.error('版本冲突！数据已被其他用户修改，请刷新页面后重试');
      } else {
        message.error('更新失败');
      }
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket) return;

    try {
      await changeStatusMutation.mutateAsync({
        id: ticket.id,
        status: newStatus,
        version: ticket.version,
      });
      message.success('状态更新成功');
      refetchTicket();
    } catch (error: any) {
      if (error?.response?.status === 409) {
        message.error('版本冲突！数据已被其他用户修改，请刷新页面后重试');
      } else {
        message.error('状态更新失败');
      }
    }
  };

  const handleCreateFollowUp = async (values: CreateFollowUpDto) => {
    if (!ticket) return;

    try {
      await createFollowUpMutation.mutateAsync({
        ...values,
        ticketId: ticket.id,
        promisedDeadline: values.promisedDeadline
          ? values.promisedDeadline.toISOString()
          : undefined,
      });
      message.success('跟进记录创建成功');
      setIsFollowUpModalVisible(false);
      followUpForm.resetFields();
      refetchTicket();
    } catch (error) {
      message.error('创建跟进记录失败');
    }
  };

  const handleReplay = async (version: number) => {
    if (!ticket) return;

    try {
      await replayTicketMutation.mutateAsync({ id: ticket.id, version });
      setSelectedVersion(version);
    } catch (error) {
      message.error('回放失败');
    }
  };

  const getFollowUpsFromEvents = (): Event[] => {
    return events
      .filter(
        (e) =>
          e.eventType === EventType.FOLLOW_UP_ADDED ||
          e.eventType === EventType.FOLLOW_UP_COMPLETED
      )
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  };

  if (ticketLoading) {
    return <div style={{ textAlign: 'center', padding: 50 }}>加载中...</div>;
  }

  if (!ticket) {
    return <Alert message="工单不存在" type="error" />;
  }

  const statusInfo = STATUS_MAP[ticket.status] || STATUS_MAP[TicketStatus.OPEN];
  const priorityInfo = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP[TicketPriority.NORMAL];
  const followUps = getFollowUpsFromEvents();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/tickets')}>
            返回
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            工单详情
            <Tag color={statusInfo.color} style={{ marginLeft: 8 }}>
              {statusInfo.label}
            </Tag>
          </Title>
        </Space>
        <Space>
          <Select
            value={ticket.status}
            style={{ width: 140 }}
            onChange={handleStatusChange}
          >
            {Object.entries(STATUS_MAP).map(([key, { label }]) => (
              <Option key={key} value={key}>{label}</Option>
            ))}
          </Select>
          <Button icon={<EditOutlined />} onClick={() => {
            editForm.setFieldsValue(ticket);
            setIsEditModalVisible(true);
          }}>
            编辑
          </Button>
          <Button
            type="primary"
            icon={<HistoryOutlined />}
            onClick={() => setIsReplayModalVisible(true)}
          >
            操作回放
          </Button>
        </Space>
      </div>

      <Alert
        message={`当前版本: v${ticket.version}。如果看到版本冲突错误，请刷新页面获取最新数据后重试。`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="基本信息" key="info">
          <Card>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="工单号">{ticket.id}</Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={priorityInfo.color}>{priorityInfo.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>{ticket.title}</Descriptions.Item>
              <Descriptions.Item label="客户姓名">{ticket.customerName || '-'}</Descriptions.Item>
              <Descriptions.Item label="客户电话">{ticket.customerPhone || '-'}</Descriptions.Item>
              <Descriptions.Item label="客户ID">{ticket.customerId}</Descriptions.Item>
              <Descriptions.Item label="分类">{ticket.category || '-'}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {ticket.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(ticket.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(ticket.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </TabPane>

        <TabPane tab="跟进记录" key="followups">
          <Card
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsFollowUpModalVisible(true)}
              >
                添加跟进
              </Button>
            }
          >
            {followUps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
                暂无跟进记录
              </div>
            ) : (
              <List
                dataSource={followUps}
                renderItem={(event) => {
                  const data = event.eventData as any;
                  const isCompleted = event.eventType === EventType.FOLLOW_UP_COMPLETED;
                  return (
                    <List.Item
                      style={{ borderBottom: '1px solid #f0f0f0', padding: '16px 0' }}
                      actions={
                        !isCompleted
                          ? [
                              <Button
                                key="complete"
                                type="link"
                                icon={<CheckCircleOutlined />}
                                onClick={() => {
                                  const followUpId = data.id;
                                  if (followUpId) {
                                    Modal.confirm({
                                      title: '完成跟进',
                                      content: (
                                        <div>
                                          <Text>请输入完成说明：</Text>
                                          <Input.TextArea
                                            id="complete-note"
                                            rows={3}
                                            style={{ marginTop: 8 }}
                                          />
                                        </div>
                                      ),
                                      onOk: async () => {
                                        const note = (document.getElementById('complete-note') as HTMLTextAreaElement)?.value;
                                        try {
                                          await completeFollowUpMutation.mutateAsync({
                                            id: followUpId,
                                            data: { completionNote: note || '已完成' },
                                          });
                                          message.success('跟进已完成');
                                          refetchTicket();
                                        } catch (error) {
                                          message.error('操作失败');
                                        }
                                      },
                                    });
                                  }
                                }}
                              >
                                完成
                              </Button>,
                            ]
                          : []
                      }
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag>{FOLLOWUP_TYPE_MAP[data.followUpType as FollowUpType] || data.followUpType}</Tag>
                            {isCompleted ? (
                              <Tag color="success">已完成</Tag>
                            ) : data.promisedDeadline ? (
                              <Tooltip title={`承诺截止: ${dayjs(data.promisedDeadline).format('YYYY-MM-DD HH:mm')}`}>
                                <Tag color={dayjs(data.promisedDeadline).isBefore(dayjs()) ? 'red' : 'orange'} icon={<ClockCircleOutlined />}>
                                  {dayjs(data.promisedDeadline).format('MM-DD HH:mm')}
                                </Tag>
                              </Tooltip>
                            ) : null}
                          </Space>
                        }
                        description={
                          <div>
                            <div style={{ marginBottom: 8 }}>{data.content}</div>
                            {data.promisedAction && (
                              <div style={{ color: '#1890ff' }}>
                                <strong>承诺：</strong>{data.promisedAction}
                              </div>
                            )}
                            {data.completionNote && (
                              <div style={{ color: '#52c41a', marginTop: 4 }}>
                                <strong>完成说明：</strong>{data.completionNote}
                              </div>
                            )}
                            <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                              {dayjs(event.createdAt).format('YYYY-MM-DD HH:mm:ss')} - 操作人: {event.operatorId.substring(0, 8)}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </TabPane>

        <TabPane tab="事件日志" key="events">
          <Card>
            <Timeline>
              {events.map((event) => (
                <Timeline.Item key={event.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <Tag color="blue">v{event.version}</Tag>
                      <span style={{ marginLeft: 8, fontWeight: 500 }}>
                        {EVENT_TYPE_MAP[event.eventType] || event.eventType}
                      </span>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(event.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  </div>
                  <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                    <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(event.eventData, null, 2)}
                    </pre>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                    操作人: {event.operatorId.substring(0, 12)} | 请求ID: {event.requestId?.substring(0, 12) || '-'}
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title="编辑工单"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateTicket}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="customerName" label="客户姓名">
            <Input />
          </Form.Item>
          <Form.Item name="customerPhone" label="客户电话">
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select>
              {Object.entries(PRIORITY_MAP).map(([key, { label }]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={updateTicketMutation.isPending}>
                保存
              </Button>
              <Button onClick={() => setIsEditModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加跟进记录"
        open={isFollowUpModalVisible}
        onCancel={() => setIsFollowUpModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={followUpForm} layout="vertical" onFinish={handleCreateFollowUp}>
          <Form.Item
            name="followUpType"
            label="跟进类型"
            rules={[{ required: true }]}
            initialValue={FollowUpType.CALL}
          >
            <Select>
              {Object.entries(FOLLOWUP_TYPE_MAP).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="content"
            label="跟进内容"
            rules={[{ required: true }]}
          >
            <TextArea rows={4} placeholder="请输入跟进内容" />
          </Form.Item>
          <Form.Item name="promisedAction" label="承诺动作">
            <Input placeholder="例如：3天内补发商品" />
          </Form.Item>
          <Form.Item name="promisedDeadline" label="承诺截止时间">
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createFollowUpMutation.isPending}
              >
                创建
              </Button>
              <Button onClick={() => setIsFollowUpModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="操作回放"
        open={isReplayModalVisible}
        onCancel={() => {
          setIsReplayModalVisible(false);
          setSelectedVersion(null);
        }}
        footer={null}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">选择版本查看历史状态（当前版本: v{ticket.version}）</Text>
        </div>
        <Select
          placeholder="选择版本"
          style={{ width: 200, marginBottom: 16 }}
          onChange={handleReplay}
        >
          {events.map((event) => (
            <Option key={event.version} value={event.version}>
              v{event.version} - {EVENT_TYPE_MAP[event.eventType] || event.eventType}
            </Option>
          ))}
        </Select>

        {replayTicketMutation.data && selectedVersion && (
          <Card title={`回放至版本 v${selectedVersion}`} type="inner">
            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, maxHeight: 400, overflow: 'auto' }}>
              {JSON.stringify(replayTicketMutation.data.state, null, 2)}
            </pre>
            <div style={{ marginTop: 16 }}>
              <Title level={5}>包含的事件:</Title>
              <List
                dataSource={replayTicketMutation.data.events}
                renderItem={(event: Event) => (
                  <List.Item>
                    <Tag>v{event.version}</Tag>
                    <span style={{ marginLeft: 8 }}>
                      {EVENT_TYPE_MAP[event.eventType] || event.eventType}
                    </span>
                    <span style={{ marginLeft: 16, color: '#999', fontSize: 12 }}>
                      {dayjs(event.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </span>
                  </List.Item>
                )}
              />
            </div>
          </Card>
        )}
      </Modal>
    </div>
  );
}

export default TicketDetailPage;
