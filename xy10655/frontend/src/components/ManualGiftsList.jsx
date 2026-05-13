import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Modal, Form, Input, Select, message } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../api';
import moment from 'moment';
const { Option } = Select;
const ManualGiftsList = ({ onRefresh }) => {
  const [manualGifts, setManualGifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  useEffect(() => {
    loadManualGifts();
    loadOrders();
    loadInventory();
  }, []);
  const loadManualGifts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/manual-gifts');
      if (response.data.success) {
        setManualGifts(response.data.data);
      }
    } catch (error) {
      message.error('加载人工补赠记录失败');
    }
    setLoading(false);
  };
  const loadOrders = async () => {
    try {
      const response = await api.get('/orders');
      if (response.data.success) {
        setOrders(response.data.data);
      }
    } catch (error) {
      message.error('加载订单列表失败');
    }
  };
  const loadInventory = async () => {
    try {
      const response = await api.get('/inventory');
      if (response.data.success) {
        setInventory(response.data.data);
      }
    } catch (error) {
      message.error('加载库存列表失败');
    }
  };
  const handleSubmit = async (values) => {
    Modal.confirm({
      title: '确认人工补赠',
      content: '确定要进行人工补赠吗？补赠后将扣减对应库存。',
      onOk: async () => {
        try {
          const selectedOrder = orders.find(o => o.id === values.order_id);
          const selectedGift = inventory.find(i => i.product_id === values.gift_product_id);
          const response = await api.post('/manual-gifts', {
            ...values,
            user_id: selectedOrder?.user_id,
            gift_product_name: selectedGift?.product_name,
            operator: '当前用户',
          });
          if (response.data.success) {
            message.success('人工补赠成功');
            setModalVisible(false);
            form.resetFields();
            loadManualGifts();
            onRefresh && onRefresh();
          }
        } catch (error) {
          message.error(error.response?.data?.error || '人工补赠失败');
        }
      },
    });
  };
  const columns = [
    { title: '订单ID', dataIndex: 'order_id', key: 'order_id', width: 200, ellipsis: true },
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 120 },
    { title: '赠品ID', dataIndex: 'gift_product_id', key: 'gift_product_id', width: 150 },
    { title: '赠品名称', dataIndex: 'gift_product_name', key: 'gift_product_name', width: 150 },
    { title: '赠品数量', dataIndex: 'gift_quantity', key: 'gift_quantity', width: 100 },
    { title: '补赠原因', dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 120 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (val) => <Tag color="success">已批准</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss') },
  ];
  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)} style={{ marginRight: 8 }}>
          新增补赠
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadManualGifts}>刷新</Button>
      </div>
      <Table
        columns={columns}
        dataSource={manualGifts}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title="新增人工补赠"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="order_id"
            label="选择订单"
            rules={[{ required: true, message: '请选择订单' }]}
          >
            <Select placeholder="请选择订单" showSearch optionFilterProp="children">
              {orders.map(order => (
                <Option key={order.id} value={order.id}>
                  {order.order_no} - {order.user_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="gift_product_id"
            label="选择赠品"
            rules={[{ required: true, message: '请选择赠品' }]}
          >
            <Select placeholder="请选择赠品">
              {inventory.map(item => (
                <Option key={item.product_id} value={item.product_id}>
                  {item.product_name} (可用: {item.available_quantity}件)
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="gift_quantity"
            label="赠品数量"
            rules={[{ required: true, message: '请输入赠品数量' }]}
          >
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item
            name="reason"
            label="补赠原因"
            rules={[{ required: true, message: '请输入补赠原因' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default ManualGiftsList;
