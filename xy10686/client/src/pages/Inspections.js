import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, DatePicker, Space, Tag, Modal, message, Popconfirm, Descriptions } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, EyeOutlined, CheckOutlined, RollbackOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { inspectionApi, deliveryApi } from '../api';

const { Option } = Select;

const statusMap = {
  draft: { text: '草稿', color: 'default' },
  submitted: { text: '已提交', color: 'processing' },
  reviewed: { text: '已审核', color: 'blue' },
  completed: { text: '已完成', color: 'success' }
};

const resultMap = {
  accepted: { text: '全部通过', color: 'success' },
  rejected: { text: '全部拒收', color: 'error' },
  partial: { text: '部分验收', color: 'warning' }
};

const Inspections = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  useEffect(() => {
    fetchData();
    fetchDeliveries();
  }, []);

  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await inspectionApi.getAll(params);
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveries = async () => {
    try {
      const res = await deliveryApi.getAll();
      if (res.data.success) {
        setDeliveries(res.data.data.filter(d => d.status !== 'accepted'));
      }
    } catch (error) {
      message.error('获取送货单列表失败');
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
      inspectionDate: record.inspectionDate ? dayjs(record.inspectionDate) : null,
      photos: record.photos ? JSON.parse(record.photos) : []
    });
    setModalVisible(true);
  };

  const handleView = (record) => {
    setViewItem(record);
    setDetailVisible(true);
  };

  const handleSubmit = async (record) => {
    try {
      await inspectionApi.submit(record.id, 'current_user');
      message.success('提交成功');
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.message || '提交失败');
    }
  };

  const handleProcessReturn = async (record) => {
    try {
      await inspectionApi.processReturn(record.id, 'current_user');
      message.success('退货处理完成');
      fetchData();
    } catch (error) {
      message.error('处理失败');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      values.operator = 'current_user';
      if (values.inspectionDate) {
        values.inspectionDate = values.inspectionDate.format('YYYY-MM-DD');
      }
      if (values.photos) {
        values.photos = JSON.stringify(values.photos);
      }

      if (editingItem) {
        await inspectionApi.update(editingItem.id, values);
        message.success('更新成功');
      } else {
        await inspectionApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const columns = [
    { title: '验收单号', dataIndex: 'inspectionNo', key: 'inspectionNo', width: 120 },
    {
      title: '送货单号',
      key: 'deliveryNo',
      width: 120,
      render: (_, record) => record.delivery?.deliveryNo || '-'
    },
    {
      title: '订单编号',
      key: 'orderNo',
      width: 120,
      render: (_, record) => record.order?.orderNo || '-'
    },
    { title: '验收数量', dataIndex: 'inspectedQuantity', key: 'inspectedQuantity', width: 100 },
    { title: '合格数量', dataIndex: 'acceptedQuantity', key: 'acceptedQuantity', width: 100 },
    { title: '拒收数量', dataIndex: 'rejectedQuantity', key: 'rejectedQuantity', width: 100 },
    {
      title: '验收结果',
      dataIndex: 'inspectionResult',
      key: 'inspectionResult',
      width: 100,
      render: (result) => {
        const info = resultMap[result] || { text: result, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    { title: '质检员', dataIndex: 'inspector', key: 'inspector', width: 80 },
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
      title: '退货处理',
      dataIndex: 'isReturnProcessed',
      key: 'isReturnProcessed',
      width: 100,
      render: (processed, record) => {
        if (record.rejectedQuantity <= 0) return '-';
        return processed ? 
          <Tag color="success">已处理</Tag> : 
          <Tag color="error">待处理</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>详情</Button>
          {record.status === 'draft' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
              <Popconfirm
                title="确认提交验收记录？"
                onConfirm={() => handleSubmit(record)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" size="small" icon={<CheckOutlined />} type="primary">提交</Button>
              </Popconfirm>
            </>
          )}
          {record.rejectedQuantity > 0 && !record.isReturnProcessed && (
            <Popconfirm
              title="确认处理退货？"
              onConfirm={() => handleProcessReturn(record)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<RollbackOutlined />} danger>处理退货</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>验收记录管理</h2>
      
      <div className="filter-form">
        <Form form={searchForm} layout="inline">
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择" style={{ width: 120 }} allowClear>
              {Object.entries(statusMap).map(([key, val]) => (
                <Option key={key} value={key}>{val.text}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="inspector" label="质检员">
            <Input placeholder="请输入" style={{ width: 120 }} />
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
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增验收</Button>
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
        title={editingItem ? '编辑验收记录' : '新增验收记录'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="inspectionNo" label="验收单号" rules={[{ required: true }]}>
            <Input disabled={!!editingItem} />
          </Form.Item>
          <Form.Item name="deliveryId" label="送货单" rules={[{ required: true }]}>
            <Select disabled={!!editingItem}>
              {deliveries.map(d => (
                <Option key={d.id} value={d.id}>{d.deliveryNo} - {d.order?.orderNo}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="inspectionDate" label="验收日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="inspectedQuantity" label="验收数量" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="acceptedQuantity" label="合格数量" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="rejectedQuantity" label="拒收数量" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="inspectionResult" label="验收结果" rules={[{ required: true }]}>
            <Select>
              {Object.entries(resultMap).map(([key, val]) => (
                <Option key={key} value={key}>{val.text}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="rejectReason" label="拒收原因">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="inspector" label="质检员" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="reviewer" label="审核人">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select>
              {Object.entries(statusMap).map(([key, val]) => (
                <Option key={key} value={key}>{val.text}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="验收记录详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {viewItem && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="验收单号">{viewItem.inspectionNo}</Descriptions.Item>
            <Descriptions.Item label="验收日期">{dayjs(viewItem.inspectionDate).format('YYYY-MM-DD')}</Descriptions.Item>
            <Descriptions.Item label="送货单号">{viewItem.delivery?.deliveryNo}</Descriptions.Item>
            <Descriptions.Item label="订单编号">{viewItem.order?.orderNo}</Descriptions.Item>
            <Descriptions.Item label="验收数量">{viewItem.inspectedQuantity}</Descriptions.Item>
            <Descriptions.Item label="合格数量">{viewItem.acceptedQuantity}</Descriptions.Item>
            <Descriptions.Item label="拒收数量">{viewItem.rejectedQuantity}</Descriptions.Item>
            <Descriptions.Item label="验收结果">{resultMap[viewItem.inspectionResult]?.text}</Descriptions.Item>
            <Descriptions.Item label="质检员">{viewItem.inspector}</Descriptions.Item>
            <Descriptions.Item label="审核人">{viewItem.reviewer || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>{statusMap[viewItem.status]?.text}</Descriptions.Item>
            {viewItem.rejectReason && (
              <Descriptions.Item label="拒收原因" span={2}>{viewItem.rejectReason}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Inspections;
