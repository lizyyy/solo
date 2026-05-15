import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, message, Select } from 'antd';
import { CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { discrepancyApi, historyApi } from '../api';
import { Discrepancy, ProcessingHistory, ReconciliationStatus, DiscrepancyType } from '../types';
import dayjs from 'dayjs';

interface DiscrepancyQueueProps {
  onStatusChange: () => void;
}

const statusColors: Record<ReconciliationStatus, string> = {
  pending: 'default',
  processing: 'processing',
  matched: 'success',
  discrepancy: 'warning',
  resolved: 'success',
  failed: 'error',
  exported: 'blue',
};

const statusLabels: Record<ReconciliationStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  matched: '已匹配',
  discrepancy: '待处理',
  resolved: '已解决',
  failed: '失败',
  exported: '已导出',
};

const typeLabels: Record<DiscrepancyType, string> = {
  amount_mismatch: '金额不匹配',
  missing_internal: '缺失内部订单',
  missing_channel: '缺失渠道流水',
  status_mismatch: '状态不匹配',
  refund_mismatch: '退款不匹配',
  duplicate: '重复记录',
  other: '其他',
};

export default function DiscrepancyQueue({ onStatusChange }: DiscrepancyQueueProps) {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ReconciliationStatus | undefined>();
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<Discrepancy | null>(null);
  const [history, setHistory] = useState<ProcessingHistory[]>([]);
  const [form] = Form.useForm();

  const loadDiscrepancies = async () => {
    setLoading(true);
    try {
      const res = await discrepancyApi.list({ status: statusFilter });
      setDiscrepancies(res.data);
    } catch (error) {
      message.error('加载差异列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscrepancies();
  }, [statusFilter]);

  const handleResolve = async (values: any) => {
    if (!selectedDiscrepancy) return;
    try {
      await discrepancyApi.resolve(selectedDiscrepancy.id, {
        resolved_note: values.resolved_note,
        operator: values.operator || 'manual',
      });
      message.success('处理成功');
      setResolveModalVisible(false);
      form.resetFields();
      loadDiscrepancies();
      onStatusChange();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '处理失败');
    }
  };

  const handleViewHistory = async (discrepancy: Discrepancy) => {
    setSelectedDiscrepancy(discrepancy);
    try {
      const res = await historyApi.list({ discrepancy_id: discrepancy.id });
      setHistory(res.data);
      setHistoryModalVisible(true);
    } catch (error) {
      message.error('加载历史失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '批次ID', dataIndex: 'batch_id', key: 'batch_id', width: 80 },
    {
      title: '差异类型',
      dataIndex: 'discrepancy_type',
      key: 'discrepancy_type',
      render: (type: DiscrepancyType) => typeLabels[type],
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '预期金额', dataIndex: 'expected_amount', key: 'expected_amount' },
    { title: '实际金额', dataIndex: 'actual_amount', key: 'actual_amount' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: ReconciliationStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Discrepancy) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => {
              setSelectedDiscrepancy(record);
              setResolveModalVisible(true);
            }}
            disabled={record.status === 'resolved'}
          >
            处理
          </Button>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            历史
          </Button>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    { title: '操作类型', dataIndex: 'action_type', key: 'action_type' },
    { title: '状态', dataIndex: 'status', key: 'status' },
    { title: '操作者', dataIndex: 'operator', key: 'operator' },
    { title: '详情', dataIndex: 'details', key: 'details' },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>异常队列</h2>
        <Space>
          <Select
            placeholder="筛选状态"
            style={{ width: 150 }}
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <Select.Option value="discrepancy">待处理</Select.Option>
            <Select.Option value="resolved">已解决</Select.Option>
          </Select>
          <Button onClick={loadDiscrepancies}>刷新</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={discrepancies}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="处理差异"
        open={resolveModalVisible}
        onCancel={() => setResolveModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleResolve} layout="vertical">
          <Form.Item name="operator" label="操作者">
            <Input placeholder="请输入操作者" />
          </Form.Item>
          <Form.Item name="resolved_note" label="处理备注" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="请输入处理说明" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              确认处理
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`历史轨迹 - 差异 #${selectedDiscrepancy?.id}`}
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={800}
      >
        <Table
          columns={historyColumns}
          dataSource={history}
          rowKey="id"
          pagination={false}
        />
      </Modal>
    </div>
  );
}
