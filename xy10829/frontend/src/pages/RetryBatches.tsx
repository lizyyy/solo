import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Card, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getRetryBatches } from '../api';
import { EventStatus, RetryBatch } from '../types';

const RetryBatches: React.FC = () => {
  const [batches, setBatches] = useState<RetryBatch[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getRetryBatches();
      setBatches(data);
    } catch (error) {
      message.error('加载补发批次失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStatusTag = (status: EventStatus) => {
    const statusMap: Record<EventStatus, { color: string; text: string }> = {
      [EventStatus.SUCCESS]: { color: 'success', text: '完成' },
      [EventStatus.FAILED]: { color: 'error', text: '失败' },
      [EventStatus.PENDING]: { color: 'default', text: '待处理' },
      [EventStatus.PROCESSING]: { color: 'processing', text: '处理中' },
      [EventStatus.RETRYING]: { color: 'warning', text: '重试中' },
      [EventStatus.CANCELLED]: { color: 'default', text: '已取消' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '批次ID',
      dataIndex: 'id',
      key: 'id',
      width: 280
    },
    {
      title: '触发人',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
      width: 120
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: EventStatus) => getStatusTag(status)
    },
    {
      title: '成功/失败',
      key: 'count',
      width: 120,
      render: (_: any, record: RetryBatch) => (
        <span>
          <Tag color="success">{record.successCount}</Tag>
          <Tag color="error">{record.failedCount}</Tag>
        </span>
      )
    },
    {
      title: '事件数',
      key: 'eventCount',
      width: 100,
      render: (_: any, record: RetryBatch) => record.eventIds.length
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
      render: (time?: string) => time ? new Date(time).toLocaleString() : '-'
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 180,
      render: (time?: string) => time ? new Date(time).toLocaleString() : '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString()
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>补发批次</h2>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={batches}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          scroll={{ x: 1400 }}
        />
      </Card>
    </div>
  );
};

export default RetryBatches;
