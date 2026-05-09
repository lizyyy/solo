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
import { orderApi, customerApi } from '../utils/api';

const { Option } = Select;

function Orders() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
    fetchCustomers();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await orderApi.getAll();
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      message.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await customerApi.getAll();
      if (res.data.success) {
        setCustomers(res.data.data);
      }
    } catch (error) {
      message.error('获取客户列表失败');
    }
  };

  const columns = [
    { title: '订单号', dataIndex: 'order_no', key: 'order_no', width: 180 },
    { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 180 },
    { title: '订单金额', dataIndex: 'amount', key: 'amount', width: 120, render: (val) => `¥${val.toLocaleString()}` },
    { 
      title: '占用额度', 
      dataIndex: 'credit_used', 
      key: 'credit_used', 
      width: 120, 
      render: (val) => <span style={{ color: '#ff4d4f' }}>-¥{val.toLocaleString()}</span> 
    },
    { title: '状态', dataIndex: 'order_status', key: 'order_status', width: 100, render: () => <Tag color="green">已完成</Tag> },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 200 },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 }
  ];

  const handleCustomerChange = (value) => {
    const customer = customers.find(c => c.id === value);
    setSelectedCustomer(customer);
    if (customer) {
      form.setFieldsValue({
        amount: undefined
      });
    }
  };

  const handleSubmit = async (values) => {
    try {
      const res = await orderApi.create({
        ...values,
        operator: '操作员'
      });
      if (res.data.success) {
        message.success(res.data.message);
        setModalVisible(false);
        form.resetFields();
        setSelectedCustomer(null);
        fetchData();
        fetchCustomers();
      } else {
        message.error(res.data.message);
      }
    } catch (error) {
      message.error('创建订单失败');
    }
  };

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            新增订单（占用额度）
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="新增订单 - 占用额度"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedCustomer(null);
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
          <Form.Item name="customer_id" label="选择客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select placeholder="请选择客户" onChange={handleCustomerChange} showSearch optionFilterProp="children">
              {customers.map(c => (
                <Option key={c.id} value={c.id}>
                  {c.name} (可用: ¥{c.available_credit.toLocaleString()})
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedCustomer && (
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <Space wrap>
                <span><strong>总额度:</strong> ¥{selectedCustomer.total_credit_limit.toLocaleString()}</span>
                <span><strong>可用额度:</strong> <span style={{ color: selectedCustomer.available_credit < 0 ? '#ff4d4f' : '#52c41a' }}>¥{selectedCustomer.available_credit.toLocaleString()}</span></span>
                <span><strong>已用额度:</strong> ¥{selectedCustomer.used_credit.toLocaleString()}</span>
              </Space>
            </div>
          )}

          <Form.Item 
            name="order_no" 
            label="订单号" 
            rules={[{ required: true, message: '请输入订单号' }]}
          >
            <Input placeholder="请输入订单号，如: SO20240101001" />
          </Form.Item>

          <Form.Item 
            name="amount" 
            label="订单金额（占用额度）" 
            rules={[
              { required: true, message: '请输入订单金额' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || !selectedCustomer) return Promise.resolve();
                  if (value > selectedCustomer.available_credit) {
                    return Promise.reject(new Error(`订单金额不能超过可用额度 (¥${selectedCustomer.available_credit.toLocaleString()})`));
                  }
                  return Promise.resolve();
                }
              })
            ]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="请输入订单金额"
              min={0.01}
              step={0.01}
              formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value.replace(/\¥\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Orders;
