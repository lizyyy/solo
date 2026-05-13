import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, Timeline, Row, Col, Modal, Form, Input, Radio, message, List, Avatar, Image } from 'antd';
import { ArrowLeftOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined, CameraOutlined } from '@ant-design/icons';
import { storeCollectionAPI } from '../services/api';
import dayjs from 'dayjs';

const StoreCollectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [reviewForm] = Form.useForm();

  useEffect(() => {
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const response = await storeCollectionAPI.detail(id);
      setDetail(response.data.data);
      setTimeline(response.data.timeline || []);
    } catch (error) {
      message.error('加载详情失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      await storeCollectionAPI.update(id, {
        ...values,
        modified_by: 1
      });
      message.success('更新成功');
      setEditModalVisible(false);
      loadDetail();
    } catch (error) {
      message.error('更新失败');
      console.error(error);
    }
  };

  const handleReview = async () => {
    try {
      const values = await reviewForm.validateFields();
      await storeCollectionAPI.review(id, values);
      message.success('审核成功');
      setReviewModalVisible(false);
      loadDetail();
    } catch (error) {
      message.error('审核失败');
      console.error(error);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'gold', text: '待处理' },
      pending_review: { color: 'orange', text: '待审核' },
      verified: { color: 'green', text: '已通过' },
      rejected: { color: 'red', text: '已拒绝' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getTimelineIcon = (item) => {
    if (item.operation === 'create') return <EditOutlined style={{ color: '#1890ff' }} />;
    if (item.operation === 'review') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (item.field_name) return <EditOutlined style={{ color: '#faad14' }} />;
    return <CheckCircleOutlined />;
  };

  const getTimelineColor = (item) => {
    if (item.operation === 'create') return 'blue';
    if (item.operation === 'review') return 'green';
    if (item.field_name) return 'orange';
    return 'blue';
  };

  if (!detail) return <div>加载中...</div>;

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/collections')} style={{ marginRight: 16 }}>
          返回列表
        </Button>
        <h2 style={{ margin: 0 }}>回收记录详情</h2>
        <Space style={{ marginLeft: 'auto' }}>
          {detail.collection_status === 'pending_review' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setReviewModalVisible(true)}>
              审核
            </Button>
          )}
          <Button icon={<EditOutlined />} onClick={() => {
            editForm.setFieldsValue(detail);
            setEditModalVisible(true);
          }}>
            编辑
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="基本信息" className="detail-card" loading={loading}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="回收单号" span={1}>{detail.collection_no}</Descriptions.Item>
              <Descriptions.Item label="状态" span={1}>{getStatusTag(detail.collection_status)}</Descriptions.Item>
              <Descriptions.Item label="门店" span={1}>{detail.Store?.store_name}</Descriptions.Item>
              <Descriptions.Item label="托盘编码" span={1}>{detail.PalletCode?.pallet_code}</Descriptions.Item>
              <Descriptions.Item label="回收日期" span={1}>{dayjs(detail.collection_date).format('YYYY-MM-DD')}</Descriptions.Item>
              <Descriptions.Item label="托盘类型" span={1}>{detail.PalletCode?.type}</Descriptions.Item>
              <Descriptions.Item label="回收数量" span={1}>{detail.collection_quantity}</Descriptions.Item>
              <Descriptions.Item label="破损数量" span={1}>{detail.damaged_quantity}</Descriptions.Item>
              <Descriptions.Item label="退款金额" span={1}>¥{detail.refund_amount || 0}</Descriptions.Item>
              <Descriptions.Item label="押金金额" span={1}>¥{detail.PalletCode?.deposit_amount || 0}</Descriptions.Item>
              <Descriptions.Item label="创建人" span={1}>{detail.Creator?.name}</Descriptions.Item>
              <Descriptions.Item label="创建时间" span={1}>{dayjs(detail.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="审核人" span={1}>{detail.Verifier?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="审核时间" span={1}>{detail.verified_at ? dayjs(detail.verified_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{detail.remark || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="破损照片" className="detail-card">
            {detail.DamagePhotos && detail.DamagePhotos.length > 0 ? (
              <List
                grid={{ gutter: 16, column: 4 }}
                dataSource={detail.DamagePhotos}
                renderItem={(photo) => (
                  <List.Item>
                    <Card
                      cover={
                        <Image
                          src={photo.photo_url || 'https://via.placeholder.com/300x200?text=破损照片'}
                          alt={photo.photo_description || '破损照片'}
                          height={200}
                          style={{ objectFit: 'cover' }}
                        />
                      }
                    >
                      <Card.Meta
                        avatar={<Avatar icon={<CameraOutlined />} />}
                        title={`破损等级: ${photo.damage_level}`}
                        description={
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <span>状态: <Tag color={photo.review_status === 'verified' ? 'green' : 'orange'}>
                              {photo.review_status === 'verified' ? '已审核' : '待审核'}
                            </Tag></span>
                            <span>上传人: {photo.Creator?.name}</span>
                            {photo.review_comment && <span>审核意见: {photo.review_comment}</span>}
                          </Space>
                        }
                      />
                    </Card>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <CameraOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>暂无破损照片</p>
              </div>
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="操作时间线" className="timeline-card">
            <Timeline>
              {timeline.sort((a, b) => new Date(a.created_at || a.modified_at) - new Date(b.created_at || b.modified_at)).map((item, index) => (
                <Timeline.Item
                  key={index}
                  color={getTimelineColor(item)}
                  dot={getTimelineIcon(item)}
                >
                  <p style={{ margin: 0, fontWeight: 'bold' }}>
                    {item.operation === 'create' ? '创建记录' :
                     item.operation === 'review' ? '审核记录' :
                     `修改字段: ${item.field_name}`}
                  </p>
                  {item.old_value !== undefined && item.new_value !== undefined && (
                    <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>
                      从 "{item.old_value}" 改为 "{item.new_value}"
                    </p>
                  )}
                  {item.reason && (
                    <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>
                      原因: {item.reason}
                    </p>
                  )}
                  {item.detail && (
                    <p style={{ margin: '4px 0', fontSize: 12, color: '#666' }}>
                      {item.detail}
                    </p>
                  )}
                  <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#999' }}>
                    {item.User?.name || '系统'} · {dayjs(item.created_at || item.modified_at).format('YYYY-MM-DD HH:mm')}
                  </p>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Col>
      </Row>

      <Modal
        title="编辑回收记录"
        open={editModalVisible}
        onOk={handleEdit}
        onCancel={() => setEditModalVisible(false)}
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="collection_quantity" label="回收数量">
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item name="damaged_quantity" label="破损数量">
            <Input type="number" min={0} />
          </Form.Item>
          <Form.Item name="refund_amount" label="退款金额">
            <Input type="number" min={0} step="0.01" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="reason" label="修改原因" rules={[{ required: true, message: '请输入修改原因' }]}>
            <Input.TextArea rows={2} placeholder="请说明修改原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="审核回收记录"
        open={reviewModalVisible}
        onOk={handleReview}
        onCancel={() => setReviewModalVisible(false)}
        width={500}
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item
            name="review_status"
            label="审核结果"
            rules={[{ required: true, message: '请选择审核结果' }]}
          >
            <Radio.Group>
              <Radio value="approve">通过</Radio>
              <Radio value="reject">拒绝</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="review_comment" label="审核意见">
            <Input.TextArea rows={3} placeholder="请输入审核意见" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StoreCollectionDetail;
