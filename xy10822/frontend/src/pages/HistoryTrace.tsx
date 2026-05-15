import { useState, useEffect } from 'react';
import { Table, Space, Tag, Input, Select, message } from 'antd';
import { historyApi } from '../api';
import { ProcessingHistory, ActionType } from '../types';
import dayjs from 'dayjs';

const actionTypeLabels: Record<ActionType, string> = {
  import: '导入',
  fetch: '拉取',
  reconcile: '对账',
  mark_resolved: '标记解决',
  mark_failed: '标记失败',
  export: '导出',
  manual_adjust: '手动调整',
};

const statusColors: Record<string, string> = {
  success: 'success',
  failed: 'error',
  warning: 'warning',
  created: 'default',
  processing: 'processing',
};

export default function HistoryTrace() {
  const [history, setHistory] = useState<ProcessingHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState<ActionType | undefined>();

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await historyApi.list();
      setHistory(res.data);
    } catch (error) {
      message.error('加载历史失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '批次ID', dataIndex: 'batch_id', key: 'batch_id', width: 80 },
    { title: '差异ID', dataIndex: 'discrepancy_id', key: 'discrepancy_id', width: 80 },
    {
      title: '操作类型',
      dataIndex: 'action_type',
      key: 'action_type',
      render: (type: ActionType) => actionTypeLabels[type],
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>{status}</Tag>
      ),
    },
    { title: '操作者', dataIndex: 'operator', key: 'operator' },
    { title: '详情', dataIndex: 'details', key: 'details', ellipsis: true },
    { title: '错误信息', dataIndex: 'error_message', key: 'error_message', ellipsis: true },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>历史轨迹</h2>
        <Space>
          <Select
            placeholder="筛选操作类型"
            style={{ width: 150 }}
            allowClear
            value={actionFilter}
            onChange={setActionFilter}
          >
            {Object.entries(actionTypeLabels).map(([value, label]) => (
              <Select.Option key={value} value={value}>{label}</Select.Option>
            ))}
          </Select>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={history}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}
