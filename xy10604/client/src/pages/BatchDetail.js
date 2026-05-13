import React, { useEffect, useState } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Table,
  Modal,
  Form,
  DatePicker,
  Input,
  message,
  Timeline,
  Tabs,
  Typography,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  UnlockOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';
import { useAuthStore } from '../store/authStore';

const { Title } = Typography;

const statusColors = {
  PENDING: 'default',
  ACTIVE: 'green',
  EXPIRED: 'red',
  BLOCKED: 'orange',
  DISCARDED: 'default',
};

const statusMap = {
  PENDING: '待处理',
  ACTIVE: '正常',
  EXPIRED: '已过期',
  BLOCKED: '已封锁',
  DISCARDED: '已废弃',
};

const experimentStatusMap = {
  PENDING: '待审批',
  APPROVED: '已批准',
  BLOCKED: '已拦截',
  REVIEWING: '待复核',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const experimentStatusColors = {
  PENDING: 'default',
  APPROVED: 'green',
  BLOCKED: 'red',
  REVIEWING: 'orange',
  COMPLETED: 'blue',
  CANCELLED: 'default',
};

const discardReasonMap = {
  EXPIRED: '过期',
  CONTAMINATED: '污染',
  UNUSED: '未使用',
  MANUAL: '人工',
};

const BatchDetail = () => {
  const [batch, setBatch] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [openModalVisible, setOpenModalVisible] = useState(false);
  const [discardModalVisible, setDiscardModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [discardForm] = Form.useForm();
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    fetchBatch();
    fetchTimeline();
  }, [id]);

  const fetchBatch = async () => {
    try {
      const response = await api.get(`/batches/${id}`);
      setBatch(response.data);
    } catch (error) {
      message.error('获取批号详情失败');
    }
  };

  const fetchTimeline = async () => {
    try {
      const response = await api.get(`/audit/timeline/BATCH/${id}`);
      setTimeline(response.data);
    } catch (error) {
      console.error('获取时间线失败:', error);
    }
  };

  const handleOpenRecord = async (values) => {
    try {
      await api.post('/open-records', {
        batchId: id,
        openDate: values.openDate.format('YYYY-MM-DD'),
        notes: values.notes,
      });
      message.success('创建开封记录成功');
      setOpenModalVisible(false);
      form.resetFields();
      fetchBatch();
      fetchTimeline();
    } catch (error) {
      message.error(error.response?.data?.error || '创建开封记录失败');
    }
  };

  const handleDiscard = async (values) => {
    try {
      await api.post('/discards', {
        batchId: id,
        reason: values.reason,
        details: values.details,
        discardedQty: values.discardedQty,
      });
      message.success('创建废弃记录成功');
      setDiscardModalVisible(false);
      discardForm.resetFields();
      fetchBatch();
      fetchTimeline();
    } catch (error) {
      message.error(error.response?.data?.error || '创建废弃记录失败');
    }
  };

  const experimentColumns = [
    {
      title: '实验编号',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '实验名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '预约日期',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={experimentStatusColors[status]}>
          {experimentStatusMap[status]}
        </Tag>
      ),
    },
  ];

  const blockColumns = [
    {
      title: '拦截原因',
      dataIndex: 'reason',
      key: 'reason',
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
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

  const discardColumns = [
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason) => discardReasonMap[reason],
    },
    {
      title: '数量',
      dataIndex: 'discardedQty',
      key: 'discardedQty',
      render: (qty, record) => `${qty} ${batch?.unit || ''}`,
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
    },
    {
      title: '时间',
      dataIndex: 'discardedAt',
      key: 'discardedAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const formatAction = (action) => {
    const actionMap = {
      CREATE_BATCH: '创建批号',
      UPDATE_BATCH_STATUS: '更新批号状态',
      UPDATE_BATCH_QTY: '更新库存数量',
      CREATE_OPEN_RECORD: '创建开封记录',
      UPDATE_OPEN_RECORD: '更新开封记录',
      CLOSE_OPEN_RECORD: '关闭开封记录',
      CREATE_EXPERIMENT: '创建实验',
      UPDATE_EXPERIMENT_STATUS: '更新实验状态',
      CREATE_REVIEW: '创建复核记录',
      REVIEW_APPROVE_EXPERIMENT: '复核通过实验',
      REVIEW_REJECT_EXPERIMENT: '复核拒绝实验',
      CREATE_DISCARD: '创建废弃记录',
    };
    return actionMap[action] || action;
  };

  if (!batch) {
    return <div>加载中...</div>;
  }

  const activeOpenRecord = batch.openRecords?.find((r) => r.isOpened);

  const tabItems = [
    {
      key: 'experiments',
      label: '关联实验',
      children: (
        <Table
          columns={experimentColumns}
          dataSource={batch.experiments}
          rowKey="id"
          pagination={false}
          size="small"
        />
      ),
    },
    {
      key: 'blocks',
      label: '拦截记录',
      children: (
        <Table
          columns={blockColumns}
          dataSource={batch.blockRecords}
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
          dataSource={batch.reviewRecords}
          rowKey="id"
          pagination={false}
          size="small"
        />
      ),
    },
    {
      key: 'discards',
      label: '废弃记录',
      children: (
        <Table
          columns={discardColumns}
          dataSource={batch.discardRecords}
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
        onClick={() => navigate('/batches')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              {batch.reagent?.name} - {batch.batchNumber}
            </Title>
            <Tag color={statusColors[batch.status]}>{statusMap[batch.status]}</Tag>
          </Space>
        }
        extra={
          <Space>
            {!activeOpenRecord && batch.status !== 'EXPIRED' && batch.status !== 'DISCARDED' && (
              <Button
                type="primary"
                icon={<UnlockOutlined />}
                onClick={() => setOpenModalVisible(true)}
              >
                创建开封记录
              </Button>
            )}
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => setDiscardModalVisible(true)}
            >
              废弃
            </Button>
          </Space>
        }
      >
        <Descriptions column={2} bordered>
          <Descriptions.Item label="试剂名称">{batch.reagent?.name}</Descriptions.Item>
          <Descriptions.Item label="试剂编码">{batch.reagent?.code}</Descriptions.Item>
          <Descriptions.Item label="批号">{batch.batchNumber}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColors[batch.status]}>{statusMap[batch.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="生产日期">
            {dayjs(batch.productionDate).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label="有效期">
            {dayjs(batch.expiryDate).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label="库存">
            {batch.currentQty} / {batch.originalQty} {batch.unit}
          </Descriptions.Item>
          <Descriptions.Item label="创建人">{batch.createdBy?.name}</Descriptions.Item>
        </Descriptions>

        {activeOpenRecord && (
          <>
            <Divider />
            <Title level={5}>
              <ClockCircleOutlined /> 当前开封记录
            </Title>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="开封日期">
                {dayjs(activeOpenRecord.openDate).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="预计过期">
                {dayjs(activeOpenRecord.expectedExpiry).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {activeOpenRecord.notes || '-'}
              </Descriptions.Item>
            </Descriptions>
          </>
        )}

        <Divider />

        <Tabs items={tabItems} />

        <Divider />

        <Title level={5}>操作时间线</Title>
        <Timeline
          items={timeline.map((log) => ({
            color: log.action.includes('CREATE') ? 'green' : 'blue',
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
        title="创建开封记录"
        open={openModalVisible}
        onCancel={() => setOpenModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleOpenRecord}>
          <Form.Item
            name="openDate"
            label="开封日期"
            rules={[{ required: true, message: '请选择开封日期' }]}
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} maxDate={dayjs()} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
              <Button onClick={() => setOpenModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="废弃试剂"
        open={discardModalVisible}
        onCancel={() => setDiscardModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={discardForm} layout="vertical" onFinish={handleDiscard}>
          <Form.Item
            name="reason"
            label="废弃原因"
            rules={[{ required: true, message: '请选择废弃原因' }]}
          >
            <Select placeholder="请选择废弃原因">
              <Select.Option value="EXPIRED">过期</Select.Option>
              <Select.Option value="CONTAMINATED">污染</Select.Option>
              <Select.Option value="UNUSED">未使用</Select.Option>
              <Select.Option value="MANUAL">人工</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="discardedQty"
            label="废弃数量"
            rules={[{ required: true, message: '请输入废弃数量' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={batch.currentQty}
              placeholder={`当前库存: ${batch.currentQty} ${batch.unit}`}
            />
          </Form.Item>
          <Form.Item name="details" label="详情说明">
            <Input.TextArea rows={3} placeholder="详细说明废弃原因" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" danger htmlType="submit">
                确认废弃
              </Button>
              <Button onClick={() => setDiscardModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BatchDetail;
