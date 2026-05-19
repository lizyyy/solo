import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, message, Card, Row, Col, Select, Modal } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, StopOutlined, EyeOutlined } from '@ant-design/icons';
import { syncAPI } from '../api';

const { Option } = Select;

interface CompensationLog {
  id: number;
  batch_id: string;
  action: string;
  details: any;
  status: string;
  error_message: string;
  retry_count: number;
  created_at: string;
  completed_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'orange',
  processing: 'blue',
  success: 'green',
  failed: 'red',
  cancelled: 'default',
};

const statusLabels: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
};

const Compensation: React.FC = () => {
  const [data, setData] = useState<CompensationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<CompensationLog | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await syncAPI.listCompensation(selectedStatus);
      setData(response.data);
    } catch (error) {
      message.error('获取补偿日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedStatus]);

  const handleRetry = async (log: CompensationLog) => {
    try {
      await syncAPI.retryCompensation(log.id);
      message.success('重试成功');
      fetchData();
    } catch (error) {
      message.error('重试失败');
    }
  };

  const handleCancel = async (log: CompensationLog) => {
    try {
      await syncAPI.cancelCompensation(log.id);
      message.success('已取消');
      fetchData();
    } catch (error) {
      message.error('取消失败');
    }
  };

  const handleViewDetail = (log: CompensationLog) => {
    setSelectedLog(log);
    setDetailModalVisible(true);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '批次ID', dataIndex: 'batch_id', key: 'batch_id' },
    { title: '操作类型', dataIndex: 'action', key: 'action' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>{statusLabels[status] || status}</Tag>
      ),
    },
    { title: '重试次数', dataIndex: 'retry_count', key: 'retry_count', width: 100 },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      ellipsis: true,
      width: 200,
      render: (text: string) => text || '-',
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    { title: '完成时间', dataIndex: 'completed_at', key: 'completed_at', render: (text: string) => text || '-' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CompensationLog) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 'pending' || record.status === 'failed' ? (
            <>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                size="small"
                onClick={() => handleRetry(record)}
              >
                重试
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                size="small"
                onClick={() => handleCancel(record)}
              >
                取消
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  const pendingCount = data.filter(d => d.status === 'pending').length;
  const failedCount = data.filter(d => d.status === 'failed').length;
  const successCount = data.filter(d => d.status === 'success').length;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <p style={{ color: '#666', margin: 0 }}>待处理</p>
            <p style={{ fontSize: 24, fontWeight: 'bold', margin: 0, color: '#fa8c16' }}>{pendingCount}</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <p style={{ color: '#666', margin: 0 }}>失败</p>
            <p style={{ fontSize: 24, fontWeight: 'bold', margin: 0, color: '#ff4d4f' }}>{failedCount}</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <p style={{ color: '#666', margin: 0 }}>成功</p>
            <p style={{ fontSize: 24, fontWeight: 'bold', margin: 0, color: '#52c41a' }}>{successCount}</p>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <p style={{ color: '#666', margin: 0 }}>总计</p>
            <p style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>{data.length}</p>
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Select
            style={{ width: 150 }}
            placeholder="筛选状态"
            allowClear
            value={selectedStatus}
            onChange={setSelectedStatus}
          >
            <Option value="pending">待处理</Option>
            <Option value="processing">处理中</Option>
            <Option value="success">成功</Option>
            <Option value="failed">失败</Option>
            <Option value="cancelled">已取消</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={data} loading={loading} rowKey="id" />

      <Modal
        title="补偿日志详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedLog && (
          <div>
            <p><strong>批次ID:</strong> {selectedLog.batch_id}</p>
            <p><strong>操作类型:</strong> {selectedLog.action}</p>
            <p><strong>状态:</strong> <Tag color={statusColors[selectedLog.status]}>{statusLabels[selectedLog.status]}</Tag></p>
            <p><strong>重试次数:</strong> {selectedLog.retry_count}</p>
            <p><strong>创建时间:</strong> {selectedLog.created_at}</p>
            <p><strong>完成时间:</strong> {selectedLog.completed_at || '-'}</p>
            {selectedLog.error_message && (
              <div>
                <p><strong>错误信息:</strong></p>
                <pre style={{ background: '#f5f5f5', padding: 10, borderRadius: 4 }}>
                  {selectedLog.error_message}
                </pre>
              </div>
            )}
            <div>
              <p><strong>详情数据:</strong></p>
              <pre style={{ background: '#f5f5f5', padding: 10, borderRadius: 4, maxHeight: 300, overflow: 'auto' }}>
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Compensation;
