import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, DatePicker, Space, Tag, Modal, message, Popover } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderApi, flowApi, auditApi } from '../api';

const { Option } = Select;
const { RangePicker } = DatePicker;

const statusMap = {
  pending: { text: '待送货', color: 'default' },
  partial_delivered: { text: '部分送货', color: 'blue' },
  delivered: { text: '已送货', color: 'processing' },
  inspected: { text: '已验收', color: 'purple' },
  returned: { text: '已退货', color: 'orange' },
  completed: { text: '已完成', color: 'success' }
};

const Orders = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [flowLogs, setFlowLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsVisible, setLogsVisible] = useState(false);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await orderApi.getAll(params);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    const params = { ...values };
    if (values.dateRange && values.dateRange.length === 2) {
      params.startDate = values.dateRange[0].format('YYYY-MM-DD');
      params.endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    delete params.dateRange;
    fetchData(params);
  };

  const handleReset = () => {
    searchForm.resetFields();
    fetchData();
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
      expectedDeliveryDate: record.expectedDeliveryDate ? dayjs(record.expectedDeliveryDate) : null
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      values.operator = 'current_user';
      if (values.expectedDeliveryDate) {
        values.expectedDeliveryDate = values.expectedDeliveryDate.format('YYYY-MM-DD');
      }

      if (editingItem) {
        await orderApi.update(editingItem.id, values);
        message.success('更新成功');
      } else {
        await orderApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const showFlowLogs = async (record) => {
    try {
      const [flowRes, auditRes] = await Promise.all([
        flowApi.getByOrderId(record.id),
        auditApi.getByEntity('order', record.id)
      ]);
      setFlowLogs(flowRes.data.success ? flowRes.data.data : []);
      setAuditLogs(auditRes.data.success ? auditRes.data.data : []);
      setLogsVisible(true);
    } catch (error) {
      message.error('获取日志失败');
    }
  };

  const columns = [
    { title: '订单编号', dataIndex: 'orderNo', key: 'orderNo', width: 120 },
    { title: '项目名称', dataIndex: 'projectName', key: 'projectName', width: 150 },
    { title: '材料名称', dataIndex: 'materialName', key: 'materialName', width: 120 },
    { title: '材料类型', dataIndex: 'materialType', key: 'materialType', width: 100 },
    { title: '规格型号', dataIndex: 'specification', key: 'specification', width: 120 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 80 },
    { title: '总金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 100 },
    { title: '供应商', dataIndex: 'supplier', key: 'supplier', width: 150 },
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
    { title: '责任人', dataIndex: 'responsiblePerson', key: 'responsiblePerson', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => showFlowLogs(record)}>流转记录</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>材料订单管理</h2>
      
      <div className="filter-form">
        <Form form={searchForm} layout="inline">
          <Form.Item name="projectName" label="项目名称">
            <Input placeholder="请输入" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="materialName" label="材料名称">
            <Input placeholder="请输入" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="supplier" label="供应商">
            <Input placeholder="请输入" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择" style={{ width: 120 }} allowClear>
              {Object.entries(statusMap).map(([key, val]) => (
                <Option key={key} value={key}>{val.text}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="responsiblePerson" label="责任人">
            <Input placeholder="请输入" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="dateRange" label="创建日期">
            <RangePicker style={{ width: 240 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增订单</Button>
      </div>

      <div className="table-container">
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1400 }}
        />
      </div>

      <Modal
        title={editingItem ? '编辑订单' : '新增订单'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="orderNo" label="订单编号" rules={[{ required: true }]}>
            <Input disabled={!!editingItem} />
          </Form.Item>
          <Form.Item name="projectName" label="项目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="materialName" label="材料名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="materialType" label="材料类型" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="specification" label="规格型号">
            <Input />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="unit" label="单位" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unitPrice" label="单价" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="totalAmount" label="总金额" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="supplier" label="供应商" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="expectedDeliveryDate" label="预计交货日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="responsiblePerson" label="责任人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="流转记录与审计日志"
        open={logsVisible}
        onCancel={() => setLogsVisible(false)}
        footer={null}
        width={800}
      >
        <h4>流转记录</h4>
        <Table
          dataSource={flowLogs}
          columns={[
            { title: '流转类型', dataIndex: 'flowType', key: 'flowType' },
            { title: '状态变更', key: 'status', render: (_, r) => `${r.fromStatus || '-'} → ${r.toStatus}` },
            { title: '操作人', dataIndex: 'operator', key: 'operator' },
            { title: '时间', dataIndex: 'createdAt', key: 'createdAt' }
          ]}
          rowKey="id"
          pagination={false}
          size="small"
        />
        <h4 style={{ marginTop: 20 }}>审计日志</h4>
        <Table
          dataSource={auditLogs}
          columns={[
            { title: '操作', dataIndex: 'action', key: 'action' },
            { title: '操作人', dataIndex: 'operator', key: 'operator' },
            { title: '变更字段', dataIndex: 'changedFields', key: 'changedFields' },
            { title: '时间', dataIndex: 'createdAt', key: 'createdAt' }
          ]}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>
    </div>
  );
};

export default Orders;
