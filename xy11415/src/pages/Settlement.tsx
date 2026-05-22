import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, Spin, message, Modal, Card, Descriptions, Space } from 'antd';
import { LockOutlined, UnlockOutlined, DollarOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/api';
import { Batch, BatchStatus, BatchStatusLabel } from '../../shared/types.js';

const Settlement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadFrozenBatches();
  }, [page, pageSize]);

  const loadFrozenBatches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      const result = await apiClient.get(`/settlement/frozen?${params}`);
      setBatches(result.batches);
      setTotal(result.total);
    } catch (error) {
      message.error('加载冻结列表失败');
    } finally {
      setLoading(false);
    }
  };

  const showComparison = async (batchId: string) => {
    try {
      const result = await apiClient.get(`/settlement/${batchId}/comparison`);
      setSelectedBatch(result);
      setCompareModalVisible(true);
    } catch (error) {
      message.error('加载对比数据失败');
    }
  };

  const handleFreeze = async (batchId: string) => {
    try {
      await apiClient.post(`/settlement/${batchId}/freeze`);
      message.success('冻结成功');
      loadFrozenBatches();
    } catch (error) {
      console.error('冻结失败:', error);
    }
  };

  const handleUnfreeze = async (batchId: string) => {
    Modal.confirm({
      title: '确认解冻',
      content: '解冻后批次将回到复核通过状态，可以重新进行修改和复核。',
      okText: '确认解冻',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiClient.post(`/settlement/${batchId}/unfreeze`, { reason: '需要重新核对' });
          message.success('解冻成功');
          loadFrozenBatches();
        } catch (error) {
          console.error('解冻失败:', error);
        }
      }
    });
  };

  const handleSettle = async (batchId: string) => {
    Modal.confirm({
      title: '确认结算',
      content: '结算后批次将进入最终状态，无法再修改。',
      okText: '确认结算',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiClient.post(`/settlement/${batchId}/settle`);
          message.success('结算完成');
          loadFrozenBatches();
        } catch (error) {
          console.error('结算失败:', error);
        }
      }
    });
  };

  const columns = [
    {
      title: '批次号',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 150
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: BatchStatus) => (
        <Tag color={status === BatchStatus.FROZEN ? 'cyan' : 'purple'}>
          {BatchStatusLabel[status]}
        </Tag>
      )
    },
    {
      title: '冻结人',
      dataIndex: 'frozenByName',
      key: 'frozenByName',
      width: 100
    },
    {
      title: '冻结时间',
      dataIndex: 'frozenAt',
      key: 'frozenAt',
      width: 180,
      render: (time: string) => time ? new Date(time).toLocaleString() : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: Batch) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/batches/${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => showComparison(record.id)}
          >
            冻结对比
          </Button>
          {record.status === BatchStatus.REVIEW_APPROVED && (
            <Button
              type="primary"
              size="small"
              icon={<LockOutlined />}
              onClick={() => handleFreeze(record.id)}
            >
              冻结
            </Button>
          )}
          {record.status === BatchStatus.FROZEN && (
            <>
              <Button
                size="small"
                icon={<UnlockOutlined />}
                onClick={() => handleUnfreeze(record.id)}
              >
                解冻
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<DollarOutlined />}
                onClick={() => handleSettle(record.id)}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              >
                结算
              </Button>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>冻结结算</h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
      ) : (
        <Table
          columns={columns}
          dataSource={batches}
          rowKey="id"
          locale={{ emptyText: '暂无冻结状态的批次' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            }
          }}
        />
      )}

      <Modal
        title="冻结前后对比"
        open={compareModalVisible}
        onCancel={() => setCompareModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedBatch && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Descriptions column={2}>
                <Descriptions.Item label="批次号">
                  {selectedBatch.batch?.batchNo}
                </Descriptions.Item>
                <Descriptions.Item label="标题">
                  {selectedBatch.batch?.title}
                </Descriptions.Item>
                <Descriptions.Item label="当前状态">
                  <Tag color="cyan">{BatchStatusLabel[selectedBatch.batch?.status as BatchStatus]}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="冻结前状态">
                  <Tag color="green">
                    {selectedBatch.statusBeforeFreeze 
                      ? BatchStatusLabel[selectedBatch.statusBeforeFreeze as BatchStatus]
                      : '-'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="冻结人">
                  {selectedBatch.batch?.frozenByName}
                </Descriptions.Item>
                <Descriptions.Item label="冻结时间">
                  {selectedBatch.batch?.frozenAt 
                    ? new Date(selectedBatch.batch.frozenAt).toLocaleString()
                    : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="改判记录">
              {selectedBatch.reviewRecords && selectedBatch.reviewRecords.length > 0 ? (
                <Table
                  size="small"
                  dataSource={selectedBatch.reviewRecords}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: '原状态', dataIndex: 'originalStatus', key: 'from', render: (s: BatchStatus) => BatchStatusLabel[s] },
                    { title: '新状态', dataIndex: 'newStatus', key: 'to', render: (s: BatchStatus) => BatchStatusLabel[s] },
                    { title: '理由', dataIndex: 'reason', key: 'reason' },
                    { title: '操作人', dataIndex: 'reviewedByName', key: 'operator', width: 100 },
                    { title: '时间', dataIndex: 'reviewedAt', key: 'time', width: 160, render: (t: string) => new Date(t).toLocaleString() }
                  ]}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                  暂无改判记录
                </div>
              )}
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Settlement;
