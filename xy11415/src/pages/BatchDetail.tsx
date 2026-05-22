import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Button, Space, Spin, message, Tabs, Table, List, Image, Timeline, Modal, Form, Input, Upload } from 'antd';
import { 
  ArrowLeftOutlined, 
  CheckOutlined, 
  CloseOutlined, 
  LockOutlined,
  UploadOutlined,
  UnlockOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { 
  BatchDetailResponse, 
  BatchStatus, 
  BatchStatusLabel, 
  Role, 
  rolePermissions 
} from '../../shared/types.js';

const { TextArea } = Input;

const BatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<BatchDetailResponse | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [form] = Form.useForm();
  const { user } = useAuthStore();

  const canReview = user ? rolePermissions[user.role as Role]?.includes('review:approve') : false;
  const canFreeze = user ? rolePermissions[user.role as Role]?.includes('settlement:freeze') : false;
  const canSettle = user ? rolePermissions[user.role as Role]?.includes('settlement:settle') : false;
  const canSubmit = user ? rolePermissions[user.role as Role]?.includes('batch:submit') : false;

  useEffect(() => {
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await apiClient.get<BatchDetailResponse>(`/batches/${id}`);
      setDetail(result);
    } catch (error) {
      message.error('加载批次详情失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: BatchStatus) => {
    const colorMap: Record<BatchStatus, string> = {
      [BatchStatus.PENDING_SUBMIT]: 'default',
      [BatchStatus.PROCESSING]: 'blue',
      [BatchStatus.PENDING_REVIEW]: 'orange',
      [BatchStatus.REVIEW_APPROVED]: 'green',
      [BatchStatus.REVIEW_REJECTED]: 'red',
      [BatchStatus.FROZEN]: 'cyan',
      [BatchStatus.SETTLED]: 'purple',
      [BatchStatus.ARCHIVED]: 'default',
      [BatchStatus.WITHDRAWN]: 'default'
    };
    return colorMap[status];
  };

  const handleSubmit = async () => {
    try {
      await apiClient.post(`/batches/${id}/submit`);
      message.success('提交成功');
      loadDetail();
    } catch (error) {
      console.error('提交失败:', error);
    }
  };

  const handleReview = (action: 'approve' | 'reject') => {
    setReviewAction(action);
    setReviewModalVisible(true);
  };

  const submitReview = async (values: any) => {
    try {
      await apiClient.post(`/review/${id}/${reviewAction}`, {
        reason: values.reason
      });
      message.success(reviewAction === 'approve' ? '复核通过' : '已驳回');
      setReviewModalVisible(false);
      form.resetFields();
      loadDetail();
    } catch (error) {
      console.error('复核失败:', error);
    }
  };

  const handleFreeze = async () => {
    try {
      await apiClient.post(`/settlement/${id}/freeze`);
      message.success('冻结成功');
      loadDetail();
    } catch (error) {
      console.error('冻结失败:', error);
    }
  };

  const handleUnfreeze = async () => {
    Modal.confirm({
      title: '确认解冻',
      content: '请输入解冻理由：',
      icon: <UnlockOutlined />,
      okText: '确认解冻',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiClient.post(`/settlement/${id}/unfreeze`, { reason: '数据有误，需要重新核对' });
          message.success('解冻成功');
          loadDetail();
        } catch (error) {
          console.error('解冻失败:', error);
        }
      }
    });
  };

  const handleSettle = async () => {
    try {
      await apiClient.post(`/settlement/${id}/settle`);
      message.success('结算完成');
      loadDetail();
    } catch (error) {
      console.error('结算失败:', error);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  if (!detail) {
    return <div>批次不存在</div>;
  }

  const rawDataColumns = [
    { title: '来源文件', dataIndex: 'sourceFile', key: 'sourceFile', width: 150 },
    { title: '行号', dataIndex: 'originalRowNumber', key: 'row', width: 80 },
    { title: '字段', dataIndex: 'fieldName', key: 'field', width: 100 },
    { title: '原始值', dataIndex: 'originalValue', key: 'original' },
    { title: '解析值', dataIndex: 'parsedValue', key: 'parsed' }
  ];

  const reviewRecordColumns = [
    { title: '原状态', dataIndex: 'originalStatus', key: 'from', render: (s: BatchStatus) => BatchStatusLabel[s] },
    { title: '新状态', dataIndex: 'newStatus', key: 'to', render: (s: BatchStatus) => BatchStatusLabel[s] },
    { title: '理由', dataIndex: 'reason', key: 'reason' },
    { title: '操作人', dataIndex: 'reviewedByName', key: 'operator', width: 100 },
    { title: '时间', dataIndex: 'reviewedAt', key: 'time', width: 180, render: (t: string) => new Date(t).toLocaleString() }
  ];

  const tabItems = [
    {
      key: 'timeline',
      label: '状态时间线',
      children: (
        <Card>
          <Timeline
            items={detail.transitions.map((t) => ({
              color: t.toStatus === BatchStatus.FROZEN ? 'blue' : 
                     t.toStatus === BatchStatus.REVIEW_APPROVED ? 'green' :
                     t.toStatus === BatchStatus.REVIEW_REJECTED ? 'red' : 'gray',
              children: (
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {BatchStatusLabel[t.toStatus as BatchStatus]}
                  </div>
                  <div style={{ color: '#666', fontSize: 12 }}>
                    {t.operatedByName} 于 {new Date(t.operatedAt).toLocaleString()}
                  </div>
                  {t.reason && <div style={{ marginTop: 8 }}>{t.reason}</div>}
                </div>
              )
            }))}
          />
        </Card>
      )
    },
    {
      key: 'rawdata',
      label: '原始数据',
      children: (
        <Table
          columns={rawDataColumns}
          dataSource={detail.rawData}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      )
    },
    {
      key: 'review',
      label: '改判记录',
      children: detail.reviewRecords.length > 0 ? (
        <Table
          columns={reviewRecordColumns}
          dataSource={detail.reviewRecords}
          rowKey="id"
          pagination={false}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无改判记录</div>
      )
    },
    {
      key: 'attachments',
      label: '附件列表',
      children: detail.attachments.length > 0 ? (
        <List
          grid={{ gutter: 16, column: 4 }}
          dataSource={detail.attachments}
          renderItem={(item) => (
            <List.Item>
              <Card
                size="small"
                cover={
                  item.fileType === 'image' ? (
                    <Image
                      src={`/api/batches/${id}/attachments/${item.storagePath.split('/')[1]}`}
                      height={120}
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ height: 120, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UploadOutlined style={{ fontSize: 48, color: '#999' }} />
                    </div>
                  )
                }
              >
                <Card.Meta title={item.fileName} description={`${(item.fileSize / 1024).toFixed(1)} KB`} />
              </Card>
            </List.Item>
          )}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无附件</div>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/batches')}
            style={{ paddingLeft: 0 }}
          >
            返回列表
          </Button>
          <h2 style={{ margin: 0 }}>{detail.batch.title}</h2>
          <Tag color={getStatusColor(detail.batch.status as BatchStatus)}>
            {BatchStatusLabel[detail.batch.status as BatchStatus]}
          </Tag>
        </div>
        <Space>
          {canSubmit && detail.batch.status === BatchStatus.PENDING_SUBMIT && (
            <Button type="primary" onClick={handleSubmit}>
              提交批次
            </Button>
          )}
          {canReview && detail.batch.status === BatchStatus.PENDING_REVIEW && (
            <>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => handleReview('approve')}>
                通过
              </Button>
              <Button danger icon={<CloseOutlined />} onClick={() => handleReview('reject')}>
                驳回
              </Button>
            </>
          )}
          {canFreeze && detail.batch.status === BatchStatus.REVIEW_APPROVED && (
            <Button type="primary" icon={<LockOutlined />} onClick={handleFreeze}>
              冻结结算
            </Button>
          )}
          {canFreeze && detail.batch.status === BatchStatus.FROZEN && (
            <Button icon={<UnlockOutlined />} onClick={handleUnfreeze}>
              解冻
            </Button>
          )}
          {canSettle && detail.batch.status === BatchStatus.FROZEN && (
            <Button type="primary" icon={<DollarOutlined />} onClick={handleSettle}>
              确认结算
            </Button>
          )}
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={3}>
          <Descriptions.Item label="批次号">{detail.batch.batchNo}</Descriptions.Item>
          <Descriptions.Item label="版本">v{detail.batch.version}</Descriptions.Item>
          <Descriptions.Item label="创建人">{detail.batch.createdByName}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {new Date(detail.batch.createdAt).toLocaleString()}
          </Descriptions.Item>
          {detail.batch.frozenAt && (
            <>
              <Descriptions.Item label="冻结人">{detail.batch.frozenByName}</Descriptions.Item>
              <Descriptions.Item label="冻结时间">
                {new Date(detail.batch.frozenAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="冻结前状态">
                {detail.batch.statusBeforeFreeze && BatchStatusLabel[detail.batch.statusBeforeFreeze as BatchStatus]}
              </Descriptions.Item>
            </>
          )}
          <Descriptions.Item label="客服备注" span={3}>
            {detail.batch.remark || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card>
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title={reviewAction === 'approve' ? '复核通过' : '复核驳回'}
        open={reviewModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setReviewModalVisible(false)}
        okText="确认"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="reason"
            label={reviewAction === 'approve' ? '通过理由' : '驳回理由'}
            rules={[{ required: true, message: '请填写理由' }]}
          >
            <TextArea rows={4} placeholder="请详细说明理由..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BatchDetail;
