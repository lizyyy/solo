import React, { useEffect, useState } from 'react';
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
  message,
  Timeline,
  Tabs,
  Typography,
  Divider,
  Table,
} from 'antd';
import {
  ArrowLeftOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';
import { useAuthStore } from '../store/authStore';

const { Title } = Typography;

const statusColors = {
  PENDING: 'default',
  APPROVED: 'green',
  BLOCKED: 'red',
  REVIEWING: 'orange',
  COMPLETED: 'blue',
  CANCELLED: 'default',
};

const statusMap = {
  PENDING: '待审批',
  APPROVED: '已批准',
  BLOCKED: '已拦截',
  REVIEWING: '待复核',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const blockReasonMap = {
  EXPIRED: '过期',
  NEAR_EXPIRY: '近效期',
  INVALID_BATCH: '无效批号',
  OPEN_DATE_INVALID: '开封日期无效',
  MANUAL_BLOCK: '人工封锁',
};

const ExperimentDetail = () => {
  const [experiment, setExperiment] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [form] = Form.useForm();
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    fetchExperiment();
    fetchTimeline();
  }, [id]);

  const fetchExperiment = async () => {
    try {
      const response = await api.get(`/experiments/${id}`);
      setExperiment(response.data);
    } catch (error) {
      message.error('获取实验详情失败');
    }
  };

  const fetchTimeline = async () => {
    try {
      const response = await api.get(`/audit/timeline/EXPERIMENT/${id}`);
      setTimeline(response.data);
    } catch (error) {
      console.error('获取时间线失败:', error);
    }
  };

  const handleReview = async (values) => {
    try {
      const pendingBlock = experiment.blockRecords.find((b) => !b.isResolved);

      await api.post('/reviews', {
        batchId: experiment.batchId,
        experimentId: experiment.id,
        blockRecordId: pendingBlock?.id,
        decision: values.decision,
        reason: values.reason,
        notes: values.notes,
      });

      message.success('复核提交成功');
      setReviewModalVisible(false);
      form.resetFields();
      fetchExperiment();
      fetchTimeline();
    } catch (error) {
      message.error(error.response?.data?.error || '复核提交失败');
    }
  };

  const formatAction = (action) => {
    const actionMap = {
      CREATE_EXPERIMENT: '创建实验',
      UPDATE_EXPERIMENT_STATUS: '更新实验状态',
      CREATE_REVIEW: '创建复核记录',
      REVIEW_APPROVE_EXPERIMENT: '复核通过实验',
      REVIEW_REJECT_EXPERIMENT: '复核拒绝实验',
    };
    return actionMap[action] || action;
  };

  const canReview =
    (user?.role === 'ADMIN' || user?.role === 'REVIEWER') &&
    (experiment?.status === 'BLOCKED' || experiment?.status === 'REVIEWING');

  if (!experiment) {
    return <div>加载中...</div>;
  }

  const blockColumns = [
    {
      title: '拦截原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason) => blockReasonMap[reason],
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
    },
    {
      title: '时间',
      dataIndex: 'blockedAt',
      key: 'blockedAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '状态',
      dataIndex: 'isResolved',
      key: 'isResolved',
      render: (resolved) => (
        <Tag color={resolved ? 'green' : 'red'}>
          {resolved ? '已解决' : '未解决'}
        </Tag>
      ),
    },
  ];

  const reviewColumns = [
    {
      title: '复核人',
      dataIndex: ['reviewer', 'name'],
      key: 'reviewer',
    },
    {
      title: '决策',
      dataIndex: 'decision',
      key: 'decision',
      render: (decision) => (
        <Tag color={decision === 'APPROVE' ? 'green' : 'red'}>
          {decision === 'APPROVE' ? '通过' : '拒绝'}
        </Tag>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'reviewedAt',
      key: 'reviewedAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const tabItems = [
    {
      key: 'blocks',
      label: '拦截记录',
      children: (
        <Table
          columns={blockColumns}
          dataSource={experiment.blockRecords}
          rowKey="id"
          pagination={false}
          size="small"
        />
      ),
    },
    {
      key: 'reviews',
      label: '复核记录',
      children: (
        <Table
          columns={reviewColumns}
          dataSource={experiment.reviewRecords}
          rowKey="id"
          pagination={false}
          size="small"
        />
      ),
    },
  ];

  return (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/experiments')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              {experiment.name}
            </Title>
            <Tag color={statusColors[experiment.status]}>
              {statusMap[experiment.status]}
            </Tag>
          </Space>
        }
        extra={
          canReview && (
            <Button
              type="primary"
              icon={<SafetyCertificateOutlined />}
              onClick={() => setReviewModalVisible(true)}
            >
              人工复核
            </Button>
          )
        }
      >
        <Descriptions column={2} bordered>
          <Descriptions.Item label="实验编号">{experiment.code}</Descriptions.Item>
          <Descriptions.Item label="实验名称">{experiment.name}</Descriptions.Item>
          <Descriptions.Item label="试剂">
            {experiment.batch?.reagent?.name}
          </Descriptions.Item>
          <Descriptions.Item label="批号">
            {experiment.batch?.batchNumber}
          </Descriptions.Item>
          <Descriptions.Item label="预约日期">
            {dayjs(experiment.scheduledDate).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColors[experiment.status]}>
              {statusMap[experiment.status]}
            </Tag>
          </Descriptions.Item>
          {experiment.actualStartDate && (
            <Descriptions.Item label="开始日期">
              {dayjs(experiment.actualStartDate).format('YYYY-MM-DD')}
            </Descriptions.Item>
          )}
          {experiment.actualEndDate && (
            <Descriptions.Item label="结束日期">
              {dayjs(experiment.actualEndDate).format('YYYY-MM-DD')}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="创建人">
            {experiment.createdBy?.name}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(experiment.createdAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <Tabs items={tabItems} />

        <Divider />

        <Title level={5}>操作时间线</Title>
        <Timeline
          items={timeline.map((log) => ({
            color: log.action.includes('CREATE') ? 'green' : log.action.includes('REVIEW') ? 'orange' : 'blue',
            children: (
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  {formatAction(log.action)}
                </div>
                <div style={{ color: '#666' }}>
                  操作人: {log.user?.name} | {dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                </div>
                {log.oldValues && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    修改前: {JSON.stringify(log.oldValues)}
                  </div>
                )}
                {log.newValues && (
                  <div style={{ fontSize: 12, color: '#999' }}>
                    修改后: {JSON.stringify(log.newValues)}
                  </div>
                )}
              </div>
            ),
          }))}
        />
      </Card>

      <Modal
        title="人工复核"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleReview}>
          <Form.Item
            name="decision"
            label="复核决策"
            rules={[{ required: true, message: '请选择复核决策' }]}
          >
            <Select placeholder="请选择复核决策">
              <Select.Option value="APPROVE">
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  通过
                </Space>
              </Select.Option>
              <Select.Option value="REJECT">
                <Space>
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  拒绝
                </Space>
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reason"
            label="复核原因"
            rules={[{ required: true, message: '请输入复核原因' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="请详细说明复核的原因和依据"
            />
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="可选，补充说明" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => setReviewModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExperimentDetail;
