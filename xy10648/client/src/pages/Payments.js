import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Tag, Space, Popconfirm, message, Progress } from 'antd';
import { PlusOutlined, CheckOutlined, DollarOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadPayments();
    loadActivities();
  }, []);

  const loadPayments = async () => {
    try {
      const response = await axios.get('/api/payments');
      setPayments(response.data);
    } catch (error) {
      message.error('加载支付数据失败');
    }
  };

  const loadActivities = async () => {
    try {
      const response = await axios.get('/api/activities');
      setActivities(response.data);
    } catch (error) {
      message.error('加载活动数据失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      await axios.post('/api/payments', {
        ...values,
        created_by: '张三'
      });
      message.success('支付请求已提交');
      setVisible(false);
      form.resetFields();
      loadPayments();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handlePaymentComplete = async (id) => {
    try {
      await axios.patch(`/api/payments/${id}/status`, {
        status: 'completed',
        transaction_id: `TXN-${Date.now()}`,
        operator: '财务'
      });
      message.success('支付已完成');
      loadPayments();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'orange',
      'processing': 'blue',
      'completed': 'green',
      'failed': 'red'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': '待支付',
      'processing': '处理中',
      'completed': '已完成',
      'failed': '支付失败'
    };
    return labels[status] || status;
  };

  const getProgressPercent = (status) => {
    const progress = {
      'pending': 25,
      'processing': 50,
      'completed': 100,
      'failed': 0
    };
    return progress[status] || 0;
  };

  const columns = [
    { title: '支付请求号', dataIndex: 'request_id', key: 'request_id' },
    { title: '所属活动', dataIndex: 'activity_id', key: 'activity_id',
      render: (id) => {
        const activity = activities.find(a => a.id === id);
        return activity ? activity.activity_name : '-';
      }
    },
    { title: '支付金额', dataIndex: 'amount', key: 'amount',
      render: (val) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>¥{val.toLocaleString()}</span>
    },
    { title: '支付方式', dataIndex: 'payment_method', key: 'payment_method', render: v => v || '-' },
    { title: '交易流水号', dataIndex: 'transaction_id', key: 'transaction_id', render: v => v || '-' },
    { title: '支付时间', dataIndex: 'paid_at', key: 'paid_at', render: v => v ? moment(v).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '支付进度', key: 'progress',
      render: (_, record) => (
        <Progress percent={getProgressPercent(record.status)} status={record.status === 'failed' ? 'exception' : 'active'} size="small" />
      )
    },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (status) => <Tag color={getStatusColor(status)} icon={<DollarOutlined />}>{getStatusLabel(status)}</Tag>
    },
    { title: '创建人', dataIndex: 'created_by', key: 'created_by' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (val) => moment(val).format('YYYY-MM-DD')
    },
    { title: '操作', key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Popconfirm title="确认标记为支付完成?" onConfirm={() => handlePaymentComplete(record.id)}>
              <Button size="small" type="primary" icon={<CheckOutlined />}>确认支付</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const totalPaid = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>支付进度</h2>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ padding: '8px 16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
            已支付: <strong style={{ color: '#52c41a' }}>¥{totalPaid.toLocaleString()}</strong>
          </div>
          <div style={{ padding: '8px 16px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4 }}>
            待支付: <strong style={{ color: '#fa8c16' }}>¥{totalPending.toLocaleString()}</strong>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            form.resetFields();
            setVisible(true);
          }}>发起支付</Button>
        </div>
      </div>
      <Table columns={columns} dataSource={payments} rowKey="id" />

      <Modal
        title="发起支付请求"
        visible={visible}
        onCancel={() => setVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="activity_id" label="所属活动" rules={[{ required: true }]}>
            <select style={{ width: '100%', height: 32, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>
              <option value="">请选择活动</option>
              {activities.filter(a => a.status === 'approved').map(a => (
                <option key={a.id} value={a.id}>{a.activity_name}</option>
              ))}
            </select>
          </Form.Item>
          <Form.Item name="request_id" label="支付请求编号" rules={[{ required: true }]}>
            <Input placeholder="如: PAY-REQ-2024001" />
          </Form.Item>
          <Form.Item name="amount" label="支付金额" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="payment_method" label="支付方式">
            <select style={{ width: '100%', height: 32, padding: '0 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>
              <option value="bank_transfer">银行转账</option>
              <option value="alipay">支付宝</option>
              <option value="wechat">微信支付</option>
              <option value="cash">现金</option>
            </select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>提交支付请求</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Payments;
