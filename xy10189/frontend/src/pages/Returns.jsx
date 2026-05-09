import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Select, 
  InputNumber, 
  Input, 
  Space, 
  Tag, 
  message,
  Card
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { returnApi, orderApi } from '../utils/api';

const { Option } = Select;

function Returns() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
    fetchOrders();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await returnApi.getAll();
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      message.error('获取退货列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await orderApi.getAll();
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (error) {
      message.error('获取订单列表失败');
    }
  };

  const columns = [
    { title: '退货单号', dataIndex: 'return_no', key: 'return_no', width: 180 },
    { title: '原订单号', dataIndex: 'order_no', key: 'order_no', width: 180 },
    { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 180 },
    { title: '退货金额', dataIndex: 'return_amount', key: 'return_amount', width: 120, render: (val) => `¥${val.toLocaleString()}` },
    { 
      title: '释放额度', 
      dataIndex: 'credit_released', 
      key: 'credit_released', 
      width: 120, 
      render: (val) => <span style={{ color: '#52c41a' }}>+¥{val.toLocaleString()}</span> 
    },
    { title: '状态', dataIndex: 'return_status', key: 'return_status', width: 100, render: () => <Tag color="green">已完成</Tag> },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 200 },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 }
  ];

  const handleOrderChange = async (value) => {
    const order = orders.find(o => o.id === value);
    if (order) {
      try {
        const returnsRes = await returnApi.getAll({ order_id: order.id });
        const existingReturns = returnsRes.data.data || [];
        const alreadyReturned = existingReturns.reduce((sum, r) => sum + r.return_amount, 0);
        const maxReturnable = order.amount - alreadyReturned;
        setSelectedOrder({ ...order, alreadyReturned, maxReturnable });
        form.setFieldsValue({
          return_amount: undefined
        });
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleSubmit = async (values) => {
    try {
      const res = await returnApi.create({
        ...values,
        operator: '操作员'
      });
      if (res.data.success) {
        message.success(res.data.message);
        setModalVisible(false);
        form.resetFields();
        setSelectedOrder(null);
        fetchData();
        fetchOrders();
      } else {
        message.error(res.data.message);
      }
    } catch (error) {
      message.error('创建退货单失败');
    }
  };

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            新增退货（释放额度）
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title="新增退货单 - 释放额度"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedOrder(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item name="order_id" label="选择原订单" rules={[{ required: true, message: '请选择订单' }]}>
            <Select placeholder="请选择要退货的订单" onChange={handleOrderChange} showSearch optionFilterProp="children">
              {orders.map(o => (
                <Option key={o.id} value={o.id}>
                  {o.order_no} - {o.customer_name} (¥{o.amount.toLocaleString()})
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedOrder && (
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <div style={{ marginBottom: 8 }}><strong>订单信息:</strong></div>
              <Space wrap>
                <span><strong>订单号:</strong> {selectedOrder.order_no}</span>
                <span><strong>客户:</strong> {selectedOrder.customer_name}</span>
              </Space>
              <Space wrap style={{ marginTop: 8 }}>
                <span><strong>订单金额:</strong> ¥{selectedOrder.amount.toLocaleString()}</span>
                <span><strong>已退货金额:</strong> ¥{(selectedOrder.alreadyReturned || 0).toLocaleString()}</span>
                <span><strong>可退金额:</strong> <span style={{ color: '#52c41a' }}>¥{selectedOrder.maxReturnable.toLocaleString()}</span></span>
              </Space>
            </div>
          )}

          <Form.Item 
            name="return_amount" 
            label="退货金额（释放额度）" 
            rules={[
              { required: true, message: '请输入退货金额' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || !selectedOrder) return Promise.resolve();
                  if (value > selectedOrder.maxReturnable) {
                    return Promise.reject(new Error(`退货金额不能超过可退金额 (¥{selectedOrder.maxReturnable.toLocaleString()})`));
                  }
                  return Promise.resolve();
                }
              })
            ]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="请输入退货金额"
              min={0.01}
              step={0.01}
              max={selectedOrder?.maxReturnable}
              formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value.replace(/\¥\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="请输入退货原因/备注" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Returns;
