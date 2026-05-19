import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Descriptions,
  Timeline,
  Tag,
  Progress,
  Button,
  Space,
  Card,
  List,
  message,
  Form,
  Select,
  Input,
  Modal,
  InputNumber,
  Typography
} from 'antd';
import {
  ArrowLeftOutlined,
  RetryOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  BellOutlined,
  SendOutlined
} from '@ant-design/icons';
import { taskApi } from '../api/task';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

const statusColors = {
  PENDING: 'default',
  RUNNING: 'processing',
  PAUSED: 'warning',
  COMPLETED: 'success',
  FAILED: 'error',
  CANCELLED: 'default'
};

const statusLabels = {
  PENDING: '待处理',
  RUNNING: '运行中',
  PAUSED: '已暂停',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消'
};

const taskTypeLabels = {
  EXPORT: '导出',
  TRANSCODE: '转码',
  PUSH: '推送'
};

function TaskDetail({ taskId, onClose, onRefresh }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [failureModalVisible, setFailureModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [progressForm] = Form.useForm();
  const [failureForm] = Form.useForm();
  const [notificationForm] = Form.useForm();

  const fetchTask = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await taskApi.get(taskId);
      setTask(res.data);
    } catch (err) {
      message.error('获取任务详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const handleUpdateStatus = async (values) => {
    try {
      await taskApi.updateStatus(taskId, values);
      message.success('状态更新成功');
      setStatusModalVisible(false);
      form.resetFields();
      fetchTask();
      onRefresh?.();
    } catch (err) {
      message.error(err.response?.data?.error || '状态更新失败');
    }
  };

  const handleUpdateProgress = async (values) => {
    try {
      await taskApi.updateProgress(taskId, values);
      message.success('进度更新成功');
      setProgressModalVisible(false);
      progressForm.resetFields();
      fetchTask();
      onRefresh?.();
    } catch (err) {
      message.error(err.response?.data?.error || '进度更新失败');
    }
  };

  const handleRecordFailure = async (values) => {
    try {
      await taskApi.recordFailure(taskId, values);
      message.success('失败记录成功');
      setFailureModalVisible(false);
      failureForm.resetFields();
      fetchTask();
      onRefresh?.();
    } catch (err) {
      message.error(err.response?.data?.error || '失败记录失败');
    }
  };

  const handleRetry = async () => {
    try {
      await taskApi.retry(taskId);
      message.success('重试成功');
      fetchTask();
      onRefresh?.();
    } catch (err) {
      message.error(err.response?.data?.error || '重试失败');
    }
  };

  const handleAddNotification = async (values) => {
    try {
      await taskApi.addNotification(taskId, values);
      message.success('通知添加成功');
      setNotificationModalVisible(false);
      notificationForm.resetFields();
      fetchTask();
      onRefresh?.();
    } catch (err) {
      message.error(err.response?.data?.error || '通知添加失败');
    }
  };

  const handleMarkNotificationSent = async (notificationId) => {
    try {
      await taskApi.markNotificationSent(taskId, notificationId);
      message.success('标记已发送成功');
      fetchTask();
      onRefresh?.();
    } catch (err) {
      message.error(err.response?.data?.error || '标记失败');
    }
  };

  const getAvailableStatuses = () => {
    if (!task) return [];
    const transitions = {
      PENDING: ['RUNNING', 'CANCELLED'],
      RUNNING: ['PAUSED', 'COMPLETED', 'CANCELLED'],
      PAUSED: ['RUNNING', 'CANCELLED'],
      FAILED: ['RUNNING', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: []
    };
    return transitions[task.current_status] || [];
  };

  if (!task) return null;

  return (
    <>
      <Drawer
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onClose}
            />
            <span>任务详情 - {task.business_no}</span>
          </Space>
        }
        open={!!taskId}
        onClose={onClose}
        width={800}
        loading={loading}
      >
        <Descriptions column={2} bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="ID">{task.id}</Descriptions.Item>
          <Descriptions.Item label="任务类型">
            {taskTypeLabels[task.task_type]}
          </Descriptions.Item>
          <Descriptions.Item label="业务单号">{task.business_no}</Descriptions.Item>
          <Descriptions.Item label="当前状态">
            <Tag color={statusColors[task.current_status]}>
              {statusLabels[task.current_status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="进度" span={2}>
            <Progress percent={task.progress} />
          </Descriptions.Item>
          <Descriptions.Item label="总数">{task.total_count}</Descriptions.Item>
          <Descriptions.Item label="成功数">
            <span style={{ color: '#52c41a' }}>{task.success_count}</span>
          </Descriptions.Item>
          <Descriptions.Item label="失败数">
            <span style={{ color: '#ff4d4f' }}>{task.fail_count}</span>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间" span={2}>
            {dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间" span={2}>
            {dayjs(task.updated_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>

        <Card title="操作" style={{ marginBottom: 16 }}>
          <Space wrap>
            {getAvailableStatuses().includes('RUNNING') && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => {
                  form.setFieldsValue({ status: 'RUNNING', message: '开始执行' });
                  setStatusModalVisible(true);
                }}
              >
                开始执行
              </Button>
            )}
            {getAvailableStatuses().includes('PAUSED') && (
              <Button
                icon={<PauseCircleOutlined />}
                onClick={() => {
                  form.setFieldsValue({ status: 'PAUSED', message: '暂停执行' });
                  setStatusModalVisible(true);
                }}
              >
                暂停
              </Button>
            )}
            {getAvailableStatuses().includes('COMPLETED') && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  form.setFieldsValue({ status: 'COMPLETED', message: '执行完成' });
                  setStatusModalVisible(true);
                }}
              >
                完成
              </Button>
            )}
            {getAvailableStatuses().includes('CANCELLED') && (
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  form.setFieldsValue({ status: 'CANCELLED', message: '取消任务' });
                  setStatusModalVisible(true);
                }}
              >
                取消
              </Button>
            )}
            {task.current_status === 'FAILED' && (
              <Button
                type="primary"
                icon={<RetryOutlined />}
                onClick={handleRetry}
              >
                重试
              </Button>
            )}
            {task.current_status === 'RUNNING' && (
              <>
                <Button
                  icon={<ExclamationCircleOutlined />}
                  onClick={() => setFailureModalVisible(true)}
                >
                  记录失败
                </Button>
                <Button onClick={() => setProgressModalVisible(true)}>
                  更新进度
                </Button>
              </>
            )}
            <Button
              icon={<BellOutlined />}
              onClick={() => setNotificationModalVisible(true)}
            >
              发送通知
            </Button>
          </Space>
        </Card>

        <Card title="状态时间线" style={{ marginBottom: 16 }}>
          <Timeline>
            {(task.events || []).map((event, index) => (
              <Timeline.Item key={index}>
                <Space>
                  <Tag color={statusColors[event.status]}>
                    {statusLabels[event.status]}
                  </Tag>
                  <span>{event.message}</span>
                  <span style={{ color: '#999', fontSize: 12 }}>
                    {dayjs(event.created_at).format('YYYY-MM-DD HH:mm:ss')}
                  </span>
                </Space>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>

        {(task.snapshots || []).length > 0 && (
          <Card title="进度快照" style={{ marginBottom: 16 }}>
            <List
              dataSource={task.snapshots}
              renderItem={(snapshot) => (
                <List.Item>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Progress percent={snapshot.progress} />
                    <div>
                      成功: {snapshot.success_count} | 失败: {snapshot.fail_count}
                      {snapshot.details && ` | ${snapshot.details}`}
                    </div>
                    <div style={{ color: '#999', fontSize: 12 }}>
                      {dayjs(snapshot.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        {(task.failures || []).length > 0 && (
          <Card title="失败记录" style={{ marginBottom: 16 }}>
            <List
              dataSource={task.failures}
              renderItem={(failure) => (
                <List.Item>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Tag color="error">{failure.error_code || 'ERROR'}</Tag>
                      <span>{failure.error_message}</span>
                    </div>
                    {failure.stack_trace && (
                      <pre style={{ background: '#f5f5f5', padding: 8, fontSize: 12 }}>
                        {failure.stack_trace}
                      </pre>
                    )}
                    <div style={{ color: '#999', fontSize: 12 }}>
                      重试次数: {failure.retry_count} | 
                      {dayjs(failure.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        {(task.notifications || []).length > 0 && (
          <Card title="通知记录" type="inner">
            <List
              dataSource={task.notifications}
              renderItem={(notification) => (
                <List.Item
                  actions={[
                    !notification.sent && (
                      <Button
                        type="link"
                        size="small"
                        icon={<SendOutlined />}
                        onClick={() => handleMarkNotificationSent(notification.id)}
                      >
                        标记已发送
                      </Button>
                    )
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={<BellOutlined />}
                    title={
                      <Space>
                        <Tag color={notification.sent ? 'success' : 'processing'}>
                          {notification.sent ? '已发送' : '待发送'}
                        </Tag>
                        <Text strong>{notification.channel}</Text>
                        <Text>→ {notification.recipient}</Text>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text>{notification.content}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          创建: {dayjs(notification.created_at).format('YYYY-MM-DD HH:mm:ss')}
                          {notification.sent_at && ` | 发送: ${dayjs(notification.sent_at).format('YYYY-MM-DD HH:mm:ss')}`}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}
      </Drawer>

      <Modal
        title="更新状态"
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdateStatus}>
          <Form.Item name="status" label="目标状态" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="message" label="备注">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="更新进度"
        open={progressModalVisible}
        onCancel={() => setProgressModalVisible(false)}
        footer={null}
      >
        <Form form={progressForm} layout="vertical" onFinish={handleUpdateProgress}>
          <Form.Item
            name="progress"
            label="进度百分比"
            rules={[{ required: true, message: '请输入进度' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="success_count" label="成功数量">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="fail_count" label="失败数量">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="details" label="详情">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="记录失败"
        open={failureModalVisible}
        onCancel={() => setFailureModalVisible(false)}
        footer={null}
      >
        <Form form={failureForm} layout="vertical" onFinish={handleRecordFailure}>
          <Form.Item name="error_code" label="错误码">
            <Input />
          </Form.Item>
          <Form.Item
            name="error_message"
            label="错误信息"
            rules={[{ required: true, message: '请输入错误信息' }]}
          >
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="stack_trace" label="堆栈信息">
            <TextArea rows={5} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发送通知"
        open={notificationModalVisible}
        onCancel={() => setNotificationModalVisible(false)}
        footer={null}
      >
        <Form form={notificationForm} layout="vertical" onFinish={handleAddNotification}>
          <Form.Item
            name="channel"
            label="通知渠道"
            rules={[{ required: true, message: '请选择通知渠道' }]}
          >
            <Select placeholder="选择通知渠道">
              <Option value="EMAIL">邮件</Option>
              <Option value="SMS">短信</Option>
              <Option value="WECHAT">微信</Option>
              <Option value="WEBHOOK">Webhook</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="recipient"
            label="接收人"
            rules={[{ required: true, message: '请输入接收人' }]}
          >
            <Input placeholder="邮箱地址/手机号/微信ID等" />
          </Form.Item>
          <Form.Item
            name="content"
            label="通知内容"
            rules={[{ required: true, message: '请输入通知内容' }]}
          >
            <TextArea rows={4} placeholder="请输入通知内容" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认发送
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default TaskDetail;
