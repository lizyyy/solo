import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Modal,
  Input,
  message,
  Timeline,
  List,
  Row,
  Col,
  Spin,
  Statistic,
  Divider,
  Form,
  Select,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { ReceiptDetail as ReceiptDetailType, Receipt } from '../types';
import {
  getReceiptDetail,
  updateReceiptStatus,
  updateReceipt,
  createAppeal,
} from '../services/api';
import {
  formatMoney,
  formatDate,
  formatDateTime,
  getReceiptStatusTag,
} from '../utils';

const { Option } = Select;

const ReceiptDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReceiptDetailType | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [appealModalVisible, setAppealModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editForm] = Form.useForm();
  const [appealForm] = Form.useForm();

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getReceiptDetail(id!);
      if (response.success) {
        setData(response.data);
        editForm.setFieldsValue({ notes: response.data.notes });
      }
    } catch (error) {
      message.error('加载小票详情失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    Modal.confirm({
      title: '确认通过',
      content: '确定要审核通过这张小票吗？通过后将从员工补贴余额中扣除相应金额。',
      okText: '确认通过',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await updateReceiptStatus(id!, {
            status: 'approved',
            operator: '管理员',
            reason: '审核通过',
          });
          if (response.success) {
            message.success('审核通过');
            loadData();
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || '操作失败');
        }
      },
    });
  };

  const handleReject = () => {
    Modal.confirm({
      title: '拒绝审核',
      content: (
        <Input.TextArea
          id="reject-reason"
          placeholder="请输入拒绝原因"
          rows={3}
          defaultValue={data?.notes}
        />
      ),
      okText: '确认拒绝',
      cancelText: '取消',
      onOk: async () => {
        const textarea = document.getElementById('reject-reason') as HTMLTextAreaElement;
        const reason = textarea?.value || '审核不通过';
        try {
          const response = await updateReceiptStatus(id!, {
            status: 'rejected',
            operator: '管理员',
            reason: reason,
          });
          if (response.success) {
            message.success('已拒绝');
            loadData();
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || '操作失败');
        }
      },
    });
  };

  const handleEditSubmit = async (values: any) => {
    try {
      setSubmitting(true);
      const response = await updateReceipt(id!, values);
      if (response.success) {
        message.success('更新成功');
        setEditModalVisible(false);
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppealSubmit = async (values: any) => {
    try {
      setSubmitting(true);
      const response = await createAppeal({
        receipt_id: id!,
        appellant: values.appellant,
        appeal_type: values.appeal_type,
        reason: values.reason,
      });
      if (response.success) {
        message.success('申诉提交成功');
        setAppealModalVisible(false);
        appealForm.resetFields();
        loadData();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;
  }

  if (!data) return null;

  const statusTag = getReceiptStatusTag(data.status);
  const canEdit = !['settled', 'approved'].includes(data.status);
  const canApprove = data.status === 'pending';

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/receipts')}>
            返回列表
          </Button>
          {canEdit && (
            <Button icon={<EditOutlined />} onClick={() => setEditModalVisible(true)}>
              编辑
            </Button>
          )}
          {canApprove && (
            <>
              <Button type="primary" icon={<CheckOutlined />} onClick={handleApprove}>
                通过
              </Button>
              <Button danger icon={<CloseOutlined />} onClick={handleReject}>
                拒绝
              </Button>
            </>
          )}
          {(data.status === 'rejected' || data.status === 'duplicate') && !data.appeal && (
            <Button icon={<ExclamationCircleOutlined />} onClick={() => setAppealModalVisible(true)}>
              申诉
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="小票基本信息" className="detail-section">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="小票编号" span={2}>
                <Space>
                  {data.receipt_no}
                  {data.is_duplicate === 1 && <Tag color="orange">重复小票</Tag>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="消费金额">
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
                  {formatMoney(data.amount)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusTag.color}>{statusTag.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="消费日期">{formatDate(data.consumption_date)}</Descriptions.Item>
              <Descriptions.Item label="上传日期">{formatDate(data.upload_date)}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(data.created_at)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatDateTime(data.updated_at)}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {data.notes || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="员工信息" className="detail-section">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="员工姓名">{data.employee_name}</Descriptions.Item>
              <Descriptions.Item label="所属部门">{data.employee_department}</Descriptions.Item>
              <Descriptions.Item label="月度补贴">
                {formatMoney(data.monthly_allowance || 0)}
              </Descriptions.Item>
              <Descriptions.Item label="已使用">
                {formatMoney(data.used_amount || 0)}
              </Descriptions.Item>
              <Descriptions.Item label="剩余余额" span={2}>
                <Statistic
                  value={(data.monthly_allowance || 0) - (data.used_amount || 0)}
                  prefix="¥"
                  precision={2}
                  valueStyle={{ color: '#52c41a', fontSize: '16px' }}
                />
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="商户信息" className="detail-section">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="商户名称">{data.merchant_name}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{data.merchant_phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="商户地址" span={2}>
                {data.merchant_address || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {data.duplicates && data.duplicates.length > 0 && (
            <Card title="关联的重复小票" className="detail-section">
              <List
                dataSource={data.duplicates}
                renderItem={(item: Receipt) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          {item.receipt_no}
                          <Tag color={getReceiptStatusTag(item.status).color}>
                            {getReceiptStatusTag(item.status).text}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space>
                          <span>员工：{item.employee_name}</span>
                          <span>金额：{formatMoney(item.amount)}</span>
                          <span>上传日期：{formatDate(item.upload_date)}</span>
                        </Space>
                      }
                    />
                    <Button type="link" size="small" onClick={() => navigate(`/receipts/${item.id}`)}>
                      查看详情
                    </Button>
                  </List.Item>
                )}
              />
            </Card>
          )}

          {data.appeal && (
            <Card title="申诉信息" className="detail-section">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="申诉人">{data.appeal.appellant}</Descriptions.Item>
                <Descriptions.Item label="申诉类型">
                  <Tag color="orange">
                    {data.appeal.appeal_type === 'reject' ? '拒绝申诉' : '重复申诉'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="申诉原因" span={2}>
                  {data.appeal.reason}
                </Descriptions.Item>
                <Descriptions.Item label="处理人">{data.appeal.handler || '-'}</Descriptions.Item>
                <Descriptions.Item label="处理结果">
                  {data.appeal.handle_result || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="申诉时间">{formatDateTime(data.appeal.created_at)}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <Card title="状态流转历史" className="detail-section">
            <Timeline className="log-timeline">
              {data.logs.map((log) => (
                <Timeline.Item key={log.id}>
                  <div>
                    <Space>
                      <Tag color={getReceiptStatusTag(log.new_status as any).color}>
                        {getReceiptStatusTag(log.new_status as any).text}
                      </Tag>
                      <span style={{ color: '#999' }}>
                        操作人：{log.operator}
                      </span>
                    </Space>
                    <div style={{ marginTop: 4, fontSize: '13px', color: '#666' }}>
                      {log.reason}
                    </div>
                    <div style={{ marginTop: 2, fontSize: '12px', color: '#999' }}>
                      {formatDateTime(log.created_at)}
                    </div>
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Col>
      </Row>

      <Modal
        title="编辑小票"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={4} placeholder="请输入备注信息" />
          </Form.Item>
          <Divider />
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setEditModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                保存
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      <Modal
        title="提交申诉"
        open={appealModalVisible}
        onCancel={() => setAppealModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={appealForm} layout="vertical" onFinish={handleAppealSubmit}>
          <Form.Item
            name="appellant"
            label="申诉人"
            rules={[{ required: true, message: '请输入申诉人姓名' }]}
          >
            <Input placeholder="请输入您的姓名" />
          </Form.Item>
          <Form.Item
            name="appeal_type"
            label="申诉类型"
            rules={[{ required: true, message: '请选择申诉类型' }]}
          >
            <Select placeholder="请选择申诉类型">
              <Option value="reject">拒绝申诉</Option>
              <Option value="duplicate">重复申诉</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="reason"
            label="申诉原因"
            rules={[{ required: true, message: '请输入申诉原因' }]}
          >
            <Input.TextArea rows={4} placeholder="请详细描述申诉原因" />
          </Form.Item>
          <Divider />
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAppealModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                提交申诉
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ReceiptDetailPage;
