import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Descriptions, Tag, Button, Space, Modal, Form, Input, Select, message, Divider, Timeline, Badge } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

const statusMap = {
  pending: { text: '待处理', color: 'default' },
  scanning: { text: '扫码中', color: 'blue' },
  sorting: { text: '分拣中', color: 'cyan' },
  weighting: { text: '称重中', color: 'purple' },
  exception: { text: '异常', color: 'red' },
  reviewing: { text: '复核中', color: 'orange' },
  rethrowing: { text: '重新投线', color: 'geekblue' },
  completed: { text: '已完成', color: 'green' }
};

const actionTypeMap = {
  scan: { text: '扫码', color: 'blue', icon: '📱' },
  sorting: { text: '分拣', color: 'cyan', icon: '📦' },
  weight: { text: '称重', color: 'purple', icon: '⚖️' },
  review: { text: '复核', color: 'orange', icon: '✅' },
  rethrow: { text: '重新投线', color: 'geekblue', icon: '🔄' },
  status: { text: '状态变更', color: 'default', icon: '📋' }
};

function PackageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [rethrowForm] = Form.useForm();
  
  const [packageData, setPackageData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [rethrowModalVisible, setRethrowModalVisible] = useState(false);

  useEffect(() => {
    fetchPackageDetail();
    fetchTimeline();
  }, [id]);

  const fetchPackageDetail = async () => {
    try {
      const response = await axios.get(`/api/packages/${id}`);
      setPackageData(response.data);
    } catch (error) {
      console.error('获取包裹详情失败:', error);
      message.error('获取包裹详情失败');
    }
  };

  const fetchTimeline = async () => {
    try {
      const response = await axios.get(`/api/packages/${id}/timeline`);
      setTimeline(response.data.timeline);
    } catch (error) {
      console.error('获取时间线失败:', error);
    }
  };

  const handleReview = async (values) => {
    setLoading(true);
    try {
      await axios.post(`/api/reviews/${packageData.package.id}`, values);
      message.success('复核成功');
      setReviewModalVisible(false);
      form.resetFields();
      fetchPackageDetail();
      fetchTimeline();
    } catch (error) {
      console.error('复核失败:', error);
      message.error('复核失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRethrow = async (values) => {
    setLoading(true);
    try {
      await axios.post(`/api/packages/${packageData.package.id}/rethrow`, values);
      message.success('重新投线成功');
      setRethrowModalVisible(false);
      rethrowForm.resetFields();
      fetchPackageDetail();
      fetchTimeline();
    } catch (error) {
      console.error('重新投线失败:', error);
      message.error('重新投线失败');
    } finally {
      setLoading(false);
    }
  };

  if (!packageData) {
    return <div>加载中...</div>;
  }

  const { package: pkg, sortingSlots, weightRecords, manualReviews, rethrowRecords } = packageData;
  const statusInfo = statusMap[pkg.status] || { text: pkg.status, color: 'default' };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回列表
        </Button>
        <Tag color={statusInfo.color} style={{ fontSize: 14, padding: '4px 12px' }}>
          {statusInfo.text}
        </Tag>
      </Space>

      <Card title="包裹基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={3} bordered>
          <Descriptions.Item label="运单号">{pkg.waybill_no}</Descriptions.Item>
          <Descriptions.Item label="重量">{pkg.weight ? `${pkg.weight} kg` : '-'}</Descriptions.Item>
          <Descriptions.Item label="目的地">{pkg.destination || '-'}</Descriptions.Item>
          <Descriptions.Item label="收件人">{pkg.receiver || '-'}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{pkg.receiver_phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="地址">{pkg.address || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(pkg.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{dayjs(pkg.updated_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
        </Descriptions>
      </Card>

      {(pkg.status === 'exception' || pkg.status === 'reviewing') && (
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Button type="primary" icon={<EditOutlined />} onClick={() => setReviewModalVisible(true)}>
              人工复核
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => setRethrowModalVisible(true)}>
              重新投线
            </Button>
          </Space>
        </Card>
      )}

      <Row gutter={16}>
        <Col span={16}>
          <Card title="操作时间线" style={{ marginBottom: 16 }}>
            <Timeline>
              {timeline.map((item, index) => {
                const typeInfo = actionTypeMap[item.type] || { text: item.type, color: 'default', icon: '📝' };
                return (
                  <Timeline.Item key={index} color={typeInfo.color}>
                    <div className="timeline-item">
                      <div className="timeline-time">
                        {typeInfo.icon} {dayjs(item.time).format('YYYY-MM-DD HH:mm:ss')}
                      </div>
                      <div className="timeline-action">
                        {typeInfo.text}: {item.action} - <Badge status={item.result === '成功' ? 'success' : 'default'} text={item.result} />
                      </div>
                      {item.operator && <div className="timeline-operator">操作人: {item.operator}</div>}
                      {item.notes && <div className="timeline-notes">备注: {item.notes}</div>}
                    </div>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          </Card>
        </Col>

        <Col span={8}>
          {sortingSlots.length > 0 && (
            <Card title="分拣记录" style={{ marginBottom: 16 }} size="small">
              {sortingSlots.map((slot, index) => (
                <div key={index} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: index < sortingSlots.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <div>格口: {slot.slot_code} ({slot.slot_name || '未命名'})</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {dayjs(slot.sorted_at).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {weightRecords.length > 0 && (
            <Card title="称重记录" style={{ marginBottom: 16 }} size="small">
              {weightRecords.map((record, index) => (
                <div key={index} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: index < weightRecords.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <div>重量: <Tag color={record.weight < 0.1 || record.weight > 50 ? 'red' : 'green'}>{record.weight} kg</Tag></div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {record.operator && `操作人: ${record.operator} | `}
                    {dayjs(record.weight_time).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {manualReviews.length > 0 && (
            <Card title="复核记录" style={{ marginBottom: 16 }} size="small">
              {manualReviews.map((review, index) => (
                <div key={index} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: index < manualReviews.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <div>
                    结果: <Tag color={review.review_result === 'pass' ? 'green' : 'orange'}>
                      {review.review_result === 'pass' ? '通过' : '驳回'}
                    </Tag>
                  </div>
                  <div>责任方: {review.responsible_party}</div>
                  {review.review_notes && <div style={{ fontSize: 12 }}>备注: {review.review_notes}</div>}
                  <div style={{ fontSize: 12, color: '#666' }}>
                    复核人: {review.reviewer} | {dayjs(review.review_time).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {rethrowRecords.length > 0 && (
            <Card title="重新投线记录" size="small">
              {rethrowRecords.map((record, index) => (
                <div key={index} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: index < rethrowRecords.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <div>原因: {record.reason || '-'}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    操作人: {record.operator} | {dayjs(record.rethrow_time).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="人工复核"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleReview}>
          <Form.Item name="reviewer" label="复核人" rules={[{ required: true, message: '请输入复核人' }]}>
            <Input placeholder="请输入复核人姓名" />
          </Form.Item>
          <Form.Item name="review_result" label="复核结果" rules={[{ required: true, message: '请选择复核结果' }]}>
            <Select placeholder="请选择复核结果">
              <Option value="pass">通过</Option>
              <Option value="reject">驳回</Option>
            </Select>
          </Form.Item>
          <Form.Item name="responsible_party" label="责任方" rules={[{ required: true, message: '请选择责任方' }]}>
            <Select placeholder="请选择责任方">
              <Option value="分拣员">分拣员</Option>
              <Option value="称重员">称重员</Option>
              <Option value="系统">系统</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="corrected_weight" label="修正重量(kg)">
            <Input type="number" step="0.01" placeholder="请输入修正后的重量" />
          </Form.Item>
          <Form.Item name="review_notes" label="复核备注">
            <TextArea rows={3} placeholder="请输入复核备注" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading} icon={<CheckCircleOutlined />}>
                确认复核
              </Button>
              <Button onClick={() => setReviewModalVisible(false)} icon={<CloseCircleOutlined />}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重新投线"
        open={rethrowModalVisible}
        onCancel={() => setRethrowModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={rethrowForm} layout="vertical" onFinish={handleRethrow}>
          <Form.Item name="operator" label="操作人" rules={[{ required: true, message: '请输入操作人' }]}>
            <Input placeholder="请输入操作人姓名" />
          </Form.Item>
          <Form.Item name="reason" label="投线原因">
            <TextArea rows={3} placeholder="请输入重新投线的原因" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading} icon={<ReloadOutlined />}>
                确认投线
              </Button>
              <Button onClick={() => setRethrowModalVisible(false)} icon={<CloseCircleOutlined />}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default PackageDetail;
