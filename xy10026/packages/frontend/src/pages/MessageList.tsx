import React, { useState } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Modal,
  Form,
  message,
  Popconfirm,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  RetweetOutlined,
  RollbackOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { messageApi } from '@/api';
import { LiveMessage, MessageType, MessageStatus } from '@live-push/shared';

const { RangePicker } = DatePicker;
const { Option } = Select;

const statusColorMap: Record<string, string> = {
  [MessageStatus.PENDING]: 'default',
  [MessageStatus.PROCESSING]: 'processing',
  [MessageStatus.DELIVERED]: 'success',
  [MessageStatus.FAILED]: 'error',
  [MessageStatus.RETRYING]: 'warning',
};

const MessageList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [roomId, setRoomId] = useState('room-001');
  const [status, setStatus] = useState<MessageStatus | undefined>();
  const [type, setType] = useState<MessageType | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['messages', roomId, pagination, status, type, dateRange],
    queryFn: () =>
      messageApi.getList({
        roomId,
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
        status,
        type,
        startTime: dateRange?.[0].toISOString(),
        endTime: dateRange?.[1].toISOString(),
      }),
  });

  const createMutation = useMutation({
    mutationFn: messageApi.create,
    onSuccess: () => {
      message.success('消息创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error: any) => {
      message.error(`创建失败: ${error.message}`);
    },
  });

  const retryMutation = useMutation({
    mutationFn: ({ messageId, params }: { messageId: string; params: any }) =>
      messageApi.retry(messageId, params),
    onSuccess: () => {
      message.success('重试成功');
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error: any) => {
      message.error(`重试失败: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ messageId, params }: { messageId: string; params: any }) =>
      messageApi.delete(messageId, params),
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error: any) => {
      message.error(`删除失败: ${error.message}`);
    },
  });

  const handleCreate = (values: any) => {
    createMutation.mutate({
      roomId,
      type: values.type,
      content: values.content,
      senderId: values.senderId || 'admin',
      senderName: values.senderName || '管理员',
      operatorId: 'admin',
      operatorName: '管理员',
      idempotencyKey: values.idempotencyKey,
      metadata: values.metadata ? JSON.parse(values.metadata) : undefined,
    });
  };

  const columns = [
    {
      title: '消息ID',
      dataIndex: 'id',
      key: 'id',
      width: 280,
      render: (id: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {id.slice(0, 8)}...
        </span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: MessageType) => <Tag>{type}</Tag>,
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '发送者',
      dataIndex: 'senderName',
      key: 'senderName',
      width: 100,
    },
    {
      title: '序号',
      dataIndex: 'sequence',
      key: 'sequence',
      width: 80,
      sorter: (a: any, b: any) => a.sequence - b.sequence,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: '重试',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 80,
      render: (count: number, record: LiveMessage) => (
        <span>
          {count}/{record.maxRetries}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: MessageStatus) => (
        <Tag color={statusColorMap[status] as any} className="status-tag">
          {status}
        </Tag>
      ),
      filters: Object.values(MessageStatus).map((s) => ({ text: s, value: s })),
      onFilter: (value: any, record: any) => record.status === value,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      fixed: 'right',
      render: (_: any, record: LiveMessage) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/messages/${record.id}`)}
          >
            详情
          </Button>
          {record.status === MessageStatus.FAILED &&
            record.retryCount < record.maxRetries && (
              <Button
                type="link"
                size="small"
                icon={<RetweetOutlined />}
                onClick={() =>
                  retryMutation.mutate({
                    messageId: record.id,
                    params: { operatorId: 'admin', operatorName: '管理员' },
                  })
                }
                loading={retryMutation.isPending}
              >
                重试
              </Button>
            )}
          <Button
            type="link"
            size="small"
            icon={<RollbackOutlined />}
            onClick={() => navigate(`/messages/${record.id}`)}
          >
            回滚
          </Button>
          <Popconfirm
            title="确定删除此消息?"
            onConfirm={() =>
              deleteMutation.mutate({
                messageId: record.id,
                params: { operatorId: 'admin', operatorName: '管理员', reason: '手动删除' },
              })
            }
            okText="删除"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
        <Space>
          <Input
            placeholder="房间ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{ width: 150 }}
          />
          <Select
            placeholder="选择状态"
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            allowClear
          >
            {Object.values(MessageStatus).map((s) => (
              <Option key={s} value={s}>
                {s}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="选择类型"
            value={type}
            onChange={setType}
            style={{ width: 120 }}
            allowClear
          >
            {Object.values(MessageType).map((t) => (
              <Option key={t} value={t}>
                {t}
              </Option>
            ))}
          </Select>
          <RangePicker
            showTime
            value={dateRange}
            onChange={(v) => setDateRange(v as any)}
            placeholder={['开始时间', '结束时间']}
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建消息
          </Button>
        </Space>
      </Space>

      <Table
        columns={columns}
        dataSource={data?.data.messages}
        rowKey="id"
        loading={isLoading}
        pagination={{
          ...pagination,
          total: data?.data.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
        }}
        scroll={{ x: 1400 }}
      />

      <Modal
        title="创建消息"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="type" label="消息类型" rules={[{ required: true }]}>
            <Select>
              {Object.values(MessageType).map((t) => (
                <Option key={t} value={t}>
                  {t}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="content" label="消息内容" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="senderId" label="发送者ID" initialValue="admin">
            <Input />
          </Form.Item>
          <Form.Item name="senderName" label="发送者名称" initialValue="管理员">
            <Input />
          </Form.Item>
          <Form.Item name="idempotencyKey" label="幂等键(可选)">
            <Input placeholder="用于防止重复提交" />
          </Form.Item>
          <Form.Item name="metadata" label="元数据(可选, JSON格式)">
            <Input.TextArea rows={2} placeholder='{"key": "value"}' />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={createMutation.isPending}>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MessageList;
