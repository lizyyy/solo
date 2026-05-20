import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  List,
  Timeline,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Steps,
  Typography,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  SafetyCertificateOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import {
  ReleaseOrder,
  ReleaseStatus,
  EnvironmentType,
  CheckItemStatus,
} from '../types';
import { releaseOrderApi, approvalApi, checkItemApi } from '../api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const statusColors: Record<ReleaseStatus, string> = {
  [ReleaseStatus.DRAFT]: 'default',
  [ReleaseStatus.PENDING_APPROVAL]: 'orange',
  [ReleaseStatus.APPROVED]: 'green',
  [ReleaseStatus.REJECTED]: 'red',
  [ReleaseStatus.DEPLOYING]: 'blue',
  [ReleaseStatus.DEPLOYED]: 'cyan',
  [ReleaseStatus.ROLLED_BACK]: 'purple',
  [ReleaseStatus.TIMEOUT]: 'red',
};

const statusLabels: Record<ReleaseStatus, string> = {
  [ReleaseStatus.DRAFT]: '草稿',
  [ReleaseStatus.PENDING_APPROVAL]: '待审批',
  [ReleaseStatus.APPROVED]: '已批准',
  [ReleaseStatus.REJECTED]: '已拒绝',
  [ReleaseStatus.DEPLOYING]: '部署中',
  [ReleaseStatus.DEPLOYED]: '已部署',
  [ReleaseStatus.ROLLED_BACK]: '已回滚',
  [ReleaseStatus.TIMEOUT]: '超时',
};

const environmentLabels: Record<EnvironmentType, string> = {
  [EnvironmentType.DEV]: '开发',
  [EnvironmentType.TEST]: '测试',
  [EnvironmentType.STAGING]: '预发布',
  [EnvironmentType.PROD]: '生产',
};

const stepOrder = [
  ReleaseStatus.DRAFT,
  ReleaseStatus.PENDING_APPROVAL,
  ReleaseStatus.APPROVED,
  ReleaseStatus.DEPLOYING,
  ReleaseStatus.DEPLOYED,
];

export default function ReleaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ReleaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [tokenForm] = Form.useForm();
  const [rollbackForm] = Form.useForm();

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await releaseOrderApi.get(parseInt(id));
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const getAvailableStatuses = () => {
    if (!data) return [];
    const currentIndex = stepOrder.indexOf(data.status);
    if (currentIndex === -1) return [];
    return stepOrder.slice(currentIndex + 1);
  };

  const handleStatusChange = async (values: { target_status: ReleaseStatus; operator: string; comment?: string }) => {
    if (!data) return;
    try {
      await releaseOrderApi.updateStatus(data.id, values);
      message.success('状态更新成功');
      setStatusModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '状态更新失败');
    }
  };

  const handleApprove = async (approvalId: number) => {
    try {
      await approvalApi.approve(approvalId, '', '当前用户');
      message.success('审批通过');
      fetchData();
    } catch (error) {
      message.error('审批失败');
    }
  };

  const handleReject = async (approvalId: number) => {
    try {
      await approvalApi.reject(approvalId, '', '当前用户');
      message.success('已拒绝');
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCheckItemUpdate = async (checkItemId: number, status: CheckItemStatus) => {
    try {
      await checkItemApi.update(checkItemId, status, '当前用户');
      message.success('检查项状态更新成功');
      fetchData();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleIssueToken = async (values: { issued_by: string; expires_hours: number }) => {
    if (!data) return;
    try {
      await releaseOrderApi.issueToken(data.id, values);
      message.success('令牌签发成功');
      setTokenModalVisible(false);
      tokenForm.resetFields();
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '令牌签发失败');
    }
  };

  const handleRollback = async (values: { reason: string; rolled_back_by: string; previous_version?: string }) => {
    if (!data) return;
    try {
      await releaseOrderApi.rollback(data.id, values);
      message.success('回滚成功');
      setRollbackModalVisible(false);
      rollbackForm.resetFields();
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '回滚失败');
    }
  };

  if (!data || loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const currentStep = stepOrder.indexOf(data.status);

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            返回列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            发布单详情 - {data.title}
          </Title>
          <Tag color={statusColors[data.status]} style={{ fontSize: 14, padding: '4px 12px' }}>
            {statusLabels[data.status]}
          </Tag>
        </div>

        <Card title="状态流转">
          <Steps current={currentStep >= 0 ? currentStep : 0}>
            {stepOrder.map((status) => (
              <Steps.Step key={status} title={statusLabels[status]} />
            ))}
          </Steps>
          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={() => setStatusModalVisible(true)}>
              更新状态
            </Button>
          </div>
        </Card>

        <Card title="基本信息">
          <Descriptions column={2} bordered>
            <Descriptions.Item label="ID">{data.id}</Descriptions.Item>
            <Descriptions.Item label="版本">{data.version || '-'}</Descriptions.Item>
            <Descriptions.Item label="环境">
              <Tag color="blue">{environmentLabels[data.environment]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建人">{data.created_by}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(data.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(data.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {data.description || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="审批列表">
          <List
            dataSource={data.approvals}
            renderItem={(approval) => (
              <List.Item
                actions={
                  approval.approved === undefined
                    ? [
                        <Button
                          type="primary"
                          size="small"
                          icon={<CheckOutlined />}
                          onClick={() => handleApprove(approval.id)}
                        >
                          通过
                        </Button>,
                        <Button
                          danger
                          size="small"
                          icon={<CloseOutlined />}
                          onClick={() => handleReject(approval.id)}
                        >
                          拒绝
                        </Button>,
                      ]
                    : []
                }
              >
                <List.Item.Meta
                  title={approval.approver}
                  description={
                    <Space>
                      <Text type="secondary">
                        创建于 {dayjs(approval.created_at).format('YYYY-MM-DD HH:mm')}
                      </Text>
                      {approval.approved !== undefined && (
                        <>
                          <Tag color={approval.approved ? 'green' : 'red'}>
                            {approval.approved ? '已通过' : '已拒绝'}
                          </Tag>
                          {approval.approved_at && (
                            <Text type="secondary">
                              于 {dayjs(approval.approved_at).format('YYYY-MM-DD HH:mm')}
                            </Text>
                          )}
                        </>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Card title="检查项">
          <List
            dataSource={data.check_items}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Select
                    size="small"
                    value={item.status}
                    onChange={(value) => handleCheckItemUpdate(item.id, value)}
                    style={{ width: 100 }}
                  >
                    <Select.Option value={CheckItemStatus.PENDING}>待检查</Select.Option>
                    <Select.Option value={CheckItemStatus.PASSED}>通过</Select.Option>
                    <Select.Option value={CheckItemStatus.FAILED}>失败</Select.Option>
                    <Select.Option value={CheckItemStatus.SKIPPED}>跳过</Select.Option>
                  </Select>,
                ]}
              >
                <List.Item.Meta
                  title={item.name}
                  description={
                    <Space>
                      <Tag
                        color={
                          item.status === CheckItemStatus.PASSED
                            ? 'green'
                            : item.status === CheckItemStatus.FAILED
                            ? 'red'
                            : 'default'
                        }
                      >
                        {item.status === CheckItemStatus.PASSED
                          ? '通过'
                          : item.status === CheckItemStatus.FAILED
                          ? '失败'
                          : item.status === CheckItemStatus.SKIPPED
                          ? '跳过'
                          : '待检查'}
                      </Tag>
                      {item.checked_by && (
                        <Text type="secondary">
                          检查人: {item.checked_by}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Card
          title="放行令牌"
          extra={
            data.status === ReleaseStatus.APPROVED && (
              <Button
                type="primary"
                size="small"
                icon={<SafetyCertificateOutlined />}
                onClick={() => setTokenModalVisible(true)}
              >
                签发令牌
              </Button>
            )
          }
        >
          <List
            dataSource={data.tokens}
            renderItem={(token) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Text code copyable>
                        {token.token}
                      </Text>
                      <Tag color={token.is_valid ? 'green' : 'red'}>
                        {token.is_valid ? '有效' : token.used ? '已使用' : '已过期'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space>
                      <Text type="secondary">签发人: {token.issued_by}</Text>
                      <Text type="secondary">
                        过期时间: {dayjs(token.expires_at).format('YYYY-MM-DD HH:mm')}
                      </Text>
                      {token.used_at && (
                        <Text type="secondary">
                          使用时间: {dayjs(token.used_at).format('YYYY-MM-DD HH:mm')}
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        {data.rollback_records.length > 0 && (
          <Card title="回滚记录">
            <List
              dataSource={data.rollback_records}
              renderItem={(record) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color="purple">已回滚</Tag>
                        <Text strong>原因: {record.reason}</Text>
                      </Space>
                    }
                    description={
                      <Space>
                        <Text type="secondary">操作人: {record.rolled_back_by}</Text>
                        <Text type="secondary">
                          回滚时间: {dayjs(record.rolled_back_at).format('YYYY-MM-DD HH:mm:ss')}
                        </Text>
                        {record.previous_version && (
                          <Text type="secondary">回滚到版本: {record.previous_version}</Text>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}

        {(data.status === ReleaseStatus.DEPLOYED || data.status === ReleaseStatus.DEPLOYING) && (
          <div>
            <Button
              danger
              icon={<RollbackOutlined />}
              onClick={() => setRollbackModalVisible(true)}
            >
              回滚发布
            </Button>
          </div>
        )}

        <Card title="操作时间线">
          <Timeline>
            {[...data.timeline].reverse().map((event) => (
              <Timeline.Item key={event.id}>
                <Space direction="vertical" size={0}>
                  <Text strong>{event.description}</Text>
                  <Space size="small">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(event.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                    {event.created_by && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        操作人: {event.created_by}
                      </Text>
                    )}
                  </Space>
                </Space>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      </Space>

      <Modal
        title="更新状态"
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleStatusChange}>
          <Form.Item
            name="target_status"
            label="目标状态"
            rules={[{ required: true, message: '请选择目标状态' }]}
          >
            <Select>
              {getAvailableStatuses().map((status) => (
                <Select.Option key={status} value={status}>
                  {statusLabels[status]}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="operator" label="操作人" rules={[{ required: true }]}>
            <Input placeholder="请输入操作人" />
          </Form.Item>
          <Form.Item name="comment" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="签发放行令牌"
        open={tokenModalVisible}
        onCancel={() => setTokenModalVisible(false)}
        onOk={() => tokenForm.submit()}
      >
        <Form form={tokenForm} layout="vertical" onFinish={handleIssueToken}>
          <Form.Item name="issued_by" label="签发人" rules={[{ required: true }]}>
            <Input placeholder="请输入签发人" />
          </Form.Item>
          <Form.Item name="expires_hours" label="有效期(小时)" initialValue={2}>
            <InputNumber min={1} max={72} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="回滚发布"
        open={rollbackModalVisible}
        onCancel={() => setRollbackModalVisible(false)}
        onOk={() => rollbackForm.submit()}
      >
        <Form form={rollbackForm} layout="vertical" onFinish={handleRollback}>
          <Form.Item name="reason" label="回滚原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="请详细说明回滚原因" />
          </Form.Item>
          <Form.Item name="rolled_back_by" label="操作人" rules={[{ required: true }]}>
            <Input placeholder="请输入操作人" />
          </Form.Item>
          <Form.Item name="previous_version" label="回滚到版本">
            <Input placeholder="可选，指定回滚到的版本" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
