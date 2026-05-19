import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, PlayCircleOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { batchApi, historyApi } from '../api';
import { ReconciliationBatch, ProcessingHistory, ReconciliationStatus } from '../types';
import dayjs from 'dayjs';

interface BatchListProps {
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
  discrepancy: '有差异',
  resolved: '已解决',
  failed: '失败',
  exported: '已导出',
};

export default function BatchList({ onStatusChange }: BatchListProps) {
  const [batches, setBatches] = useState<ReconciliationBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ReconciliationBatch | null>(null);
  const [history, setHistory] = useState<ProcessingHistory[]>([]);
  const [form] = Form.useForm();

  const loadBatches = async () => {
    setLoading(true);
    try {
      const res = await batchApi.list();
      setBatches(res.data);
    } catch (error) {
      message.error('加载批次列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      await batchApi.create({
        ...values,
        reconciliation_date: dayjs().toISOString(),
      });
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      loadBatches();
      onStatusChange();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '创建失败');
    }
  };

  const handleReconcile = async (id: number) => {
    try {
      await batchApi.reconcile(id);
      message.success('对账完成');
      loadBatches();
      onStatusChange();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '对账失败');
    }
  };

  const handleExport = async (id: number, batchNo: string) => {
    try {
      const res = await batchApi.export(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `reconciliation_${batchNo}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
      loadBatches();
      onStatusChange();
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleViewHistory = async (batch: ReconciliationBatch) => {
    setSelectedBatch(batch);
    try {
      const res = await historyApi.list({ batch_id: batch.id });
      setHistory(res.data);
      setHistoryModalVisible(true);
    } catch (error) {
      message.error('加载历史失败');
    }
  };

  const columns = [
    { title: '批次号', dataIndex: 'batch_no', key: 'batch_no' },
    { title: '渠道', dataIndex: 'channel', key: 'channel' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: ReconciliationStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    { title: '渠道流水数', dataIndex: 'total_channel_count', key: 'total_channel_count' },
    { title: '内部订单数', dataIndex: 'total_internal_count', key: 'total_internal_count' },
    { title: '匹配数', dataIndex: 'matched_count', key: 'matched_count' },
    { title: '差异数', dataIndex: 'discrepancy_count', key: 'discrepancy_count' },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ReconciliationBatch) => (
        <Space>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleReconcile(record.id)}
            disabled={record.status === 'processing'}
          >
            执行对账
          </Button>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            历史
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleExport(record.id, record.batch_no)}
          >
            导出
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
        <h2>对账批次</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新建批次
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={batches}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="新建批次"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="batch_no" label="批次号" rules={[{ required: true }]}>
            <Input placeholder="例如: BATCH-20240101-001" />
          </Form.Item>
          <Form.Item name="channel" label="渠道" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="alipay">支付宝</Select.Option>
              <Select.Option value="wechat">微信支付</Select.Option>
              <Select.Option value="unionpay">银联</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`历史轨迹 - ${selectedBatch?.batch_no}`}
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
