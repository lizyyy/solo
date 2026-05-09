import React, { useState } from 'react';
import {
  Card,
  Descriptions,
  Button,
  Tag,
  Space,
  Tabs,
  Table,
  Modal,
  Form,
  Input,
  message,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  RetweetOutlined,
  RollbackOutlined,
  EditOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { messageApi, replayApi } from '@/api';
import { LiveMessage, MessageStatus } from '@live-push/shared';

const statusColorMap: Record<string, string> = {
  [MessageStatus.PENDING]: 'default',
  [MessageStatus.PROCESSING]: 'processing',
  [MessageStatus.DELIVERED]: 'success',
  [MessageStatus.FAILED]: 'error',
  [MessageStatus.RETRYING]: 'warning',
};

const MessageDetail: React.FC = () => {
  const { messageId } = useParams<{ messageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('info');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [rollbackForm] = Form.useForm();

  const { data: messageData, isLoading } = useQuery({
    queryKey: ['message', messageId],
    queryFn: () => messageApi.getById(messageId!),
    enabled: !!messageId,
  });

  const { data: pathData } = useQuery({
    queryKey: ['messagePath', messageId],
    queryFn: () => replayApi.getExecutionPath(messageId!),
    enabled: !!messageId && activeTab === 'history',
  });

  const { data: diagnosisData } = useQuery({
    queryKey: ['messageDiagnosis', messageId],
    queryFn: () => replayApi.diagnose(messageId!),
    enabled: !!messageId && activeTab === 'diagnosis',
  });

  const updateMutation = useMutation({
    mutationFn: (params: any) => messageApi.update(messageId!, params),
    onSuccess: () => {
      message.success('更新成功');
      setEditModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['message', messageId] });
    },
    onError: (error: any) => {
      message.error(`更新失败: ${error.message}`);
    },
  });

  const retryMutation = useMutation({
    mutationFn: (params: any) => messageApi.retry(messageId!, params),
    onSuccess: () => {
      message.success('重试成功');
      queryClient.invalidateQueries({ queryKey: ['message', messageId] });
    },
    onError: (error: any) => {
      message.error(`重试失败: ${error.message}`);
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (params: any) => messageApi.rollback(messageId!, params),
    onSuccess: () => {
      message.success('回滚成功');
      setRollbackModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['message', messageId] });
    },
    onError: (error: any) => {
      message.error(`回滚失败: ${error.message}`);
    },
  });

  const handleEdit = (values: any) => {
    const message = messageData?.data;
    updateMutation.mutate({
      content: values.content,
      metadata: values.metadata ? JSON.parse(values.metadata) : undefined,
      expectedVersion: message?.version,
      operatorId: 'admin',
      operatorName: '管理员',
      reason: values.reason,
    });
  };

  const handleRollback = (values: any) => {
    rollbackMutation.mutate({
      operatorId: 'admin',
      operatorName: '管理员',
      reason: values.reason,
    });
  };

  const message = messageData?.data;

  if (isLoading) {
    return <div>加载中...</div>;
  }

  if (!message) {
    return <div>消息不存在</div>;
  }

  const historyColumns = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: '事件类型',
      dataIndex: 'eventType',
      key: 'eventType',
      width: 150,
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '状态',
      dataIndex: ['state', 'status'],
      key: 'status',
      width: 120,
      render: (status: MessageStatus) => (
        <Tag color={statusColorMap[status] as any}>{status}</Tag>
      ),
    },
    {
      title: '重试次数',
      dataIndex: ['state', 'retryCount'],
      key: 'retryCount',
      width: 100,
    },
  ];

  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: (
        <Card title="消息详情">
          <Descriptions bordered column={2}>
            <Descriptions.Item label="消息ID" span={2}>
              <span style={{ fontFamily: 'monospace' }}>{message.id}</span>
            </Descriptions.Item>
            <Descriptions.Item label="房间ID">{message.roomId}</Descriptions.Item>
            <Descriptions.Item label="序号">#{message.sequence}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag>{message.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="版本">v{message.version}</Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>
              <Tag color={statusColorMap[message.status] as any}>{message.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="发送者">{message.senderName} ({message.senderId})</Descriptions.Item>
            <Descriptions.Item label="重试">{message.retryCount}/{message.maxRetries}</Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              {dayjs(message.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间" span={2}>
              {dayjs(message.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            {message.deliveredAt && (
              <Descriptions.Item label="送达时间" span={2}>
                {dayjs(message.deliveredAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="内容" span={2}>
              <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                {message.content}
              </div>
            </Descriptions.Item>
            {message.metadata && (
              <Descriptions.Item label="元数据" span={2}>
                <pre className="json-viewer">{JSON.stringify(message.metadata, null, 2)}</pre>
              </Descriptions.Item>
            )}
          </Descriptions>

          <Divider />

          <Space>
            <Button onClick={() => navigate('/messages')} icon={<ArrowLeftOutlined />}>
              返回列表
            </Button>
            <Button icon={<EditOutlined />} onClick={() => setEditModalVisible(true)}>
              编辑
            </Button>
            {message.status === MessageStatus.FAILED && message.retryCount < message.maxRetries && (
              <Button
                type="primary"
                icon={<RetweetOutlined />}
                onClick={() =>
                  retryMutation.mutate({ operatorId: 'admin', operatorName: '管理员' })
                }
                loading={retryMutation.isPending}
              >
                重试推送
              </Button>
            )}
            <Button
              danger
              icon={<RollbackOutlined />}
              onClick={() => setRollbackModalVisible(true)}
            >
              回滚
            </Button>
          </Space>
        </Card>
      ),
    },
    {
      key: 'history',
      label: '执行历史',
      children: (
        <Card title="消息生命周期">
          <Table
            columns={historyColumns}
            dataSource={pathData?.data}
            rowKey="version"
            pagination={false}
          />
        </Card>
      ),
    },
    {
      key: 'diagnosis',
      label: '问题诊断',
      children: (
        <Card title="诊断报告">
          {diagnosisData?.data.anomalies.length === 0 ? (
            <div style={{ color: '#52c41a', fontSize: 16 }}>未检测到异常 ✓</div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <h4>异常情况:</h4>
                <ul>
                  {diagnosisData?.data.anomalies.map((a: string, i: number) => (
                    <li key={i} style={{ color: '#ff4d4f' }}>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>建议:</h4>
                <ul>
                  {diagnosisData?.data.recommendations.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <Divider />

          <Button
            icon={<HistoryOutlined />}
            onClick={() => navigate('/replay')}
          >
            查看完整回放
          </Button>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal
        title="编辑消息"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEdit}
          initialValues={{
            content: message.content,
            metadata: message.metadata ? JSON.stringify(message.metadata) : '',
          }}
        >
          <Form.Item name="content" label="消息内容" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="metadata" label="元数据">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="reason" label="变更原因">
            <Input placeholder="请说明修改原因" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={updateMutation.isPending}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="回滚消息"
        open={rollbackModalVisible}
        onCancel={() => setRollbackModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={rollbackForm} layout="vertical" onFinish={handleRollback}>
          <Form.Item name="reason" label="回滚原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="请说明回滚原因" />
          </Form.Item>
          <div style={{ marginBottom: 16, padding: 12, background: '#fff7e6', borderRadius: 4 }}>
            ⚠️ 回滚将恢复到上一个版本，当前版本 v{message.version} 的修改将被撤销
          </div>
          <Form.Item>
            <Button type="primary" danger htmlType="submit" block loading={rollbackMutation.isPending}>
              确认回滚
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MessageDetail;
