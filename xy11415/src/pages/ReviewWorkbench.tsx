import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, Spin, message, Modal, Form, Input, Space } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/api';
import { Batch, BatchStatus, BatchStatusLabel } from '../../shared/types.js';

const { TextArea } = Input;

const ReviewWorkbench: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    loadPendingBatches();
  }, [page, pageSize]);

  const loadPendingBatches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
      });
      const result = await apiClient.get(`/review/pending?${params}`);
      setBatches(result.batches);
      setTotal(result.total);
    } catch (error) {
      message.error('加载待复核列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (batch: Batch, action: 'approve' | 'reject') => {
    setSelectedBatch(batch);
    setReviewAction(action);
    setModalVisible(true);
  };

  const submitReview = async (values: any) => {
    if (!selectedBatch) return;

    try {
      await apiClient.post(`/review/${selectedBatch.id}/${reviewAction}`, {
        reason: values.reason
      });
      message.success(reviewAction === 'approve' ? '复核通过' : '已驳回');
      setModalVisible(false);
      form.resetFields();
      loadPendingBatches();
    } catch (error) {
      console.error('复核失败:', error);
    }
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
        <Tag color="orange">{BatchStatusLabel[status]}</Tag>
      )
    },
    {
      title: '创建人',
      dataIndex: 'createdByName',
      key: 'createdByName',
      width: 100
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: Batch) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/batches/${record.id}`)}
          >
            查看
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleReview(record, 'approve')}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            通过
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleReview(record, 'reject')}
          >
            驳回
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>复核工作台</h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
      ) : (
        <Table
          columns={columns}
          dataSource={batches}
          rowKey="id"
          locale={{ emptyText: '暂无待复核的批次' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条待复核`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            }
          }}
        />
      )}

      <Modal
        title={reviewAction === 'approve' ? '复核通过' : '复核驳回'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => setModalVisible(false)}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ 
          style: reviewAction === 'approve' 
            ? { background: '#52c41a', borderColor: '#52c41a' } 
            : { background: '#ff4d4f', borderColor: '#ff4d4f' } 
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#666' }}>批次：</div>
          <div style={{ fontWeight: 'bold' }}>
            {selectedBatch?.batchNo} - {selectedBatch?.title}
          </div>
        </div>
        <Form form={form} layout="vertical">
          <Form.Item
            name="reason"
            label={reviewAction === 'approve' ? '通过理由' : '驳回理由'}
            rules={[{ required: true, message: '请填写理由' }]}
          >
            <TextArea 
              rows={4} 
              placeholder={reviewAction === 'approve' 
                ? '请说明复核通过的理由...' 
                : '请详细说明驳回的原因，以便客服调整...'
              } 
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReviewWorkbench;
