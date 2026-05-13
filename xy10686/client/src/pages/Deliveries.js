import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, DatePicker, Space, Tag, Modal, message } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { deliveryApi, orderApi } from '../api';

const { Option } = Select;

const statusMap = {
  pending: { text: '待验收', color: 'default' },
  inspecting: { text: '验收中', color: 'processing' },
  accepted: { text: '验收通过', color: 'success' },
  rejected: { text: '全部拒收', color: 'error' },
  partial_accepted: { text: '部分验收', color: 'warning' },
  returned: { text: '已退货', color: 'orange' }
};

const Deliveries = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [orders, setOrders] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  useEffect(() => {
    fetchData();
    fetchOrders();
  }, []);

  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await deliveryApi.getAll(params);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      message.error('获取数据失败');
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

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    fetchData(values);
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      deliveryDate: record.deliveryDate ? dayjs(record.deliveryDate) : null
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      values.operator = 'current_user';
      if (values.deliveryDate) {
        values.deliveryDate = values.deliveryDate.format('YYYY-MM-DD');
      }

      if (editingItem) {
        await deliveryApi.update(editingItem.id, values);
        message.success('更新成功');
      } else {
        await deliveryApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const columns = [
    { title: '送货单号', dataIndex: 'deliveryNo', key: 'deliveryNo', width: 120 },
    {
      title: '关联订单',
      key: 'order',
      width: 150,
      render: (_, record) => record.order?.orderNo || '-'
    },
    {
      title: '项目名称',
      key: 'projectName',
      width: 150,
      render: (_, record) => record.order?.projectName || '-'
    },
    {
      title: '材料名称',
      key: 'materialName',
      width: 120,
      render: (_, record) => record.order?.materialName || '-'
    },
    { title: '送货数量', dataIndex: 'deliveredQuantity', key: 'deliveredQuantity', width: 100 },
    { title: '司机', dataIndex: 'driverName', key: 'driverName', width: 80 },
    { title: '车牌号', dataIndex: 'vehicleNo', key: 'vehicleNo', width: 100 },
    { title: '批次号', dataIndex: 'batchNo', key: 'batchNo', width: 100 },
    { title: '签收人', dataIndex: 'receivedBy', key: 'receivedBy', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const info = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
      )
    }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>送货管理</h2>
      
      <div className="filter-form">
        <Form form={searchForm} layout="inline">
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择" style={{ width: 120 }} allowClear>
              {Object.entries(statusMap).map(([key, val]) => (
                <Option key={key} value={key}>{val.text}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
              <Button onClick={() => searchForm.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增送货</Button>
      </div>

      <div className="table-container">
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </div>

      <Modal
        title={editingItem ? '编辑送货单' : '新增送货单'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="deliveryNo" label="送货单号" rules={[{ required: true }]}>
            <Input disabled={!!editingItem} />
          </Form.Item>
          <Form.Item name="orderId" label="关联订单" rules={[{ required: true }]}>
            <Select disabled={!!editingItem}>
              {orders.map(order => (
                <Option key={order.id} value={order.id}>{order.orderNo} - {order.projectName}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="deliveryDate" label="送货日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="deliveredQuantity" label="送货数量" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="driverName" label="司机姓名">
            <Input />
          </Form.Item>
          <Form.Item name="vehicleNo" label="车牌号">
            <Input />
          </Form.Item>
          <Form.Item name="batchNo" label="批次号">
            <Input />
          </Form.Item>
          <Form.Item name="receivedBy" label="签收人">
            <Input />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Deliveries;
