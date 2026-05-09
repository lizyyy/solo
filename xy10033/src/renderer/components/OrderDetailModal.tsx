import React, { useState, useEffect } from 'react';
import {
  Modal,
  Descriptions,
  Tag,
  Timeline,
  Button,
  Select,
  Input,
  Form,
  Space,
  message,
  Card,
  Row,
  Col
} from 'antd';
import { User, ReissueOrder, ReissueStatus, ReissueHistory } from '../../shared/types';
import { STATUS_LABELS, STATUS_COLORS, STATUS_TRANSITIONS } from '../../shared/constants';
import dayjs from 'dayjs';
import { hasPermission } from '../hooks/useAuth';

const { Option } = Select;
const { TextArea } = Input;

interface OrderDetailModalProps {
  orderId: string | null;
  onClose: () => void;
  currentUser: Omit<User, 'password'>;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ orderId, onClose, currentUser }) => {
  const [order, setOrder] = useState<ReissueOrder | null>(null);
  const [history, setHistory] = useState<ReissueHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    if (!orderId) return;
    
    setLoading(true);
    try {
      const [orderResult, historyResult] = await Promise.all([
        window.electronAPI.order.get(orderId),
        window.electronAPI.order.history(orderId)
      ]);

      if (orderResult.success) {
        setOrder(orderResult.data);
      }
      if (historyResult.success) {
        setHistory(historyResult.data);
      }
    } catch (error) {
      message.error('加载订单详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orderId]);

  const handleStatusChange = async (values: { newStatus: ReissueStatus; reason: string }) => {
    if (!order) return;

    try {
      const result = await window.electronAPI.order.changeStatus(
        order.id,
        values.newStatus,
        values.reason || null
      );

      if (result.success) {
        message.success('状态更新成功');
        form.resetFields();
        loadData();
      }
    } catch (error: any) {
      message.error(error.message || '状态更新失败');
    }
  };

  const getNextStatuses = (): string[] => {
    if (!order) return [];
    return STATUS_TRANSITIONS[order.status] || [];
  };

  const nextStatuses = getNextStatuses();

  return (
    <Modal
      title="订单详情"
      open={!!orderId}
      onCancel={onClose}
      footer={null}
      width={900}
      loading={loading}
    >
      {order && (
        <div>
          <Card title="基本信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="订单号">{order.orderNo}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLORS[order.status]}>
                  {STATUS_LABELS[order.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="客户姓名" span={2}>{order.customerName}</Descriptions.Item>
              <Descriptions.Item label="客户电话">{order.customerPhone}</Descriptions.Item>
              <Descriptions.Item label="处理人">{order.assigneeName || '-'}</Descriptions.Item>
              <Descriptions.Item label="客户地址" span={2}>{order.customerAddress || '-'}</Descriptions.Item>
              <Descriptions.Item label="商品名称" span={2}>{order.productName}</Descriptions.Item>
              <Descriptions.Item label="商品SKU">{order.productSku || '-'}</Descriptions.Item>
              <Descriptions.Item label="数量">{order.quantity}</Descriptions.Item>
              <Descriptions.Item label="补发原因">{order.reason}</Descriptions.Item>
              <Descriptions.Item label="详细描述" span={2}>
                {order.description || '-'}
              </Descriptions.Item>
              {order.trackingNo && (
                <>
                  <Descriptions.Item label="快递单号">{order.trackingNo}</Descriptions.Item>
                  <Descriptions.Item label="物流公司">{order.shippingCompany || '-'}</Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="创建时间">
                {dayjs(order.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(order.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {order.completedAt && (
                <Descriptions.Item label="完成时间" span={2}>
                  {dayjs(order.completedAt).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {hasPermission(currentUser, 'order.update') && nextStatuses.length > 0 && (
            <Card title="状态流转" style={{ marginBottom: 16 }}>
              <Form
                form={form}
                layout="inline"
                onFinish={handleStatusChange}
              >
                <Form.Item
                  name="newStatus"
                  label="更改为"
                  rules={[{ required: true, message: '请选择状态' }]}
                >
                  <Select style={{ width: 150 }} placeholder="选择状态">
                    {nextStatuses.map(status => (
                      <Option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="reason" label="原因">
                  <TextArea
                    rows={1}
                    placeholder="变更原因（可选）"
                    style={{ width: 300 }}
                  />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    确认变更
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          )}

          <Card title="处理历史">
            <Timeline className="history-timeline">
              {history.map((item, index) => (
                <Timeline.Item
                  key={item.id}
                  color={index === history.length - 1 ? 'blue' : 'gray'}
                >
                  <div>
                    <Space>
                      <Tag color={STATUS_COLORS[item.afterStatus]}>
                        {STATUS_LABELS[item.afterStatus]}
                      </Tag>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        操作人: {item.operatorName}
                      </span>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                      </span>
                    </Space>
                    {item.changeReason && (
                      <div style={{ marginTop: 4, color: '#666' }}>
                        原因: {item.changeReason}
                      </div>
                    )}
                  </div>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </div>
      )}
    </Modal>
  );
};

export default OrderDetailModal;
