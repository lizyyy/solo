import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Card,
  Tag,
  Space,
  Alert
} from 'antd';
import {
  ReloadOutlined,
  MinusCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { TextArea } = Input;

function Refunds() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refundResult, setRefundResult] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/orders');
      setOrders(res.data.filter(o => o.status === 'paid' || o.status === 'partially_refunded'));
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const columns = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      width: 200
    },
    {
      title: '课程',
      dataIndex: 'course_name',
      key: 'course_name'
    },
    {
      title: '学员',
      dataIndex: 'student_name',
      key: 'student_name'
    },
    {
      title: '团长',
      dataIndex: 'team_leader_name',
      key: 'team_leader_name'
    },
    {
      title: '实付金额',
      dataIndex: 'final_price',
      key: 'final_price',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '已退款',
      dataIndex: 'refund_amount',
      key: 'refund_amount',
      render: v => v > 0 ? (
        <span className="diff-negative">¥{v.toFixed(2)}</span>
      ) : '-'
    },
    {
      title: '可退款',
      key: 'refundable',
      render: (_, record) => {
        const refundable = record.final_price - (record.refund_amount || 0);
        return <span style={{ color: '#52c41a' }}>¥{refundable.toFixed(2)}</span>;
      }
    },
    {
      title: '当前佣金',
      dataIndex: 'commission_amount',
      key: 'commission_amount',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        const statusMap = {
          'paid': { color: 'green', text: '已付款' },
          'partially_refunded': { color: 'orange', text: '部分退款' }
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    {
      title: '结算状态',
      dataIndex: 'is_settled',
      key: 'is_settled',
      render: v => v ? (
        <Tag color="blue">已结算</Tag>
      ) : (
        <Tag color="default">未结算</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const refundable = record.final_price - (record.refund_amount || 0);
        return (
          <Button
            type="danger"
            size="small"
            icon={<MinusCircleOutlined />}
            disabled={refundable <= 0}
            onClick={() => showRefundModal(record)}
          >
            退款
          </Button>
        );
      }
    }
  ];

  const showRefundModal = (order) => {
    setSelectedOrder(order);
    setRefundResult(null);
    form.setFieldsValue({
      refund_amount: null,
      refund_reason: ''
    });
    setRefundModalVisible(true);
  };

  const handleRefund = async (values) => {
    try {
      const res = await axios.post(`/api/orders/${selectedOrder.id}/refund`, values);
      setRefundResult(res.data);
      message.success('退款处理成功');
      loadData();
    } catch (error) {
      message.error('退款失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const getRefundable = () => {
    if (!selectedOrder) return 0;
    return selectedOrder.final_price - (selectedOrder.refund_amount || 0);
  };

  return (
    <div>
      <Card>
        <div className="operation-buttons">
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
        </div>

        <Alert
          message="退款说明"
          description={
            <div>
              <p>• 支持全额退款和部分退款</p>
              <p>• 退款金额按比例冲减佣金</p>
              <p>• 已结算订单的退款会自动扣减已结算佣金</p>
              <p>• 退款后订单状态变为"部分退款"或"已退款"</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="处理退款"
        open={refundModalVisible}
        onCancel={() => setRefundModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedOrder && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>订单号：</span>
                <span style={{ fontFamily: 'monospace' }}>{selectedOrder.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>学员：</span>
                <span>{selectedOrder.student_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>课程：</span>
                <span>{selectedOrder.course_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>实付金额：</span>
                <span>¥{selectedOrder.final_price.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>已退款：</span>
                <span className="diff-negative">¥{(selectedOrder.refund_amount || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>可退款金额：</span>
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                  ¥{getRefundable().toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>当前佣金：</span>
                <span>¥{selectedOrder.commission_amount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>结算状态：</span>
                <Tag color={selectedOrder.is_settled ? 'blue' : 'default'}>
                  {selectedOrder.is_settled ? '已结算' : '未结算'}
                </Tag>
              </div>
              {selectedOrder.is_settled === 1 && (
                <Alert
                  message="该订单已结算，退款佣金将从对应结算中扣减"
                  type="warning"
                  showIcon
                  style={{ marginTop: 12 }}
                />
              )}
            </Card>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleRefund}
            >
              <Form.Item
                name="refund_amount"
                label="退款金额"
                rules={[
                  { required: true, message: '请输入退款金额' },
                  { 
                    validator: (_, value) => {
                      if (value <= 0) return Promise.reject('退款金额必须大于0');
                      if (value > getRefundable()) {
                        return Promise.reject('退款金额不能超过可退款金额');
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <InputNumber
                  min={0}
                  step={0.01}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder={`最大可退 ¥${getRefundable().toFixed(2)}`}
                />
              </Form.Item>
              <Form.Item
                name="refund_reason"
                label="退款原因"
              >
                <TextArea rows={3} placeholder="请输入退款原因（可选）" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" danger htmlType="submit">
                    确认退款
                  </Button>
                  <Button onClick={() => setRefundModalVisible(false)}>
                    取消
                  </Button>
                </Space>
              </Form.Item>
            </Form>

            {refundResult && (
              <div className="processing-result">
                <h4 style={{ marginBottom: 12 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                  退款结果
                </h4>
                <div className="result-item">
                  <span className="result-label">订单号</span>
                  <span className="result-value" style={{ fontFamily: 'monospace' }}>
                    {refundResult.order_id}
                  </span>
                </div>
                <div className="result-item">
                  <span className="result-label">退款金额</span>
                  <span className="result-value negative">
                    ¥{refundResult.refund_amount.toFixed(2)}
                  </span>
                </div>
                <div className="result-item">
                  <span className="result-label">佣金扣减</span>
                  <span className="result-value negative">
                    ¥{refundResult.commission_deduction.toFixed(2)}
                  </span>
                </div>
                <div className="result-item">
                  <span className="result-label">剩余佣金</span>
                  <span className="result-value">
                    ¥{refundResult.new_commission.toFixed(2)}
                  </span>
                </div>
                <div className="result-item">
                  <span className="result-label">订单状态</span>
                  <span className="result-value">
                    {refundResult.new_status === 'refunded' ? '已退款' : '部分退款'}
                  </span>
                </div>
                {refundResult.was_settled && (
                  <div className="result-item">
                    <span className="result-label">结算处理</span>
                    <span className="result-value negative">
                      已从结算 #{refundResult.settlement_id} 扣减佣金
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Refunds;
