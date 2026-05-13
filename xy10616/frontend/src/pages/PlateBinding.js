import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, DatePicker, Modal, Space, message, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { plateBindingAPI } from '../services/api';

const { Option } = Select;

const PlateBinding = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize]);

  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await plateBindingAPI.list({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...params,
      });
      if (res.success) {
        setList(res.data.list);
        setPagination((prev) => ({ ...prev, total: res.data.total }));
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    fetchData(values);
  };

  const handleReset = () => {
    searchForm.resetFields();
    fetchData();
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      valid_from: record.valid_from ? dayjs(record.valid_from) : undefined,
      valid_to: record.valid_to ? dayjs(record.valid_to) : undefined,
    });
    setIsModalOpen(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const submitData = {
        ...values,
        valid_from: values.valid_from ? values.valid_from.format('YYYY-MM-DD') : undefined,
        valid_to: values.valid_to ? values.valid_to.format('YYYY-MM-DD') : undefined,
      };

      if (editingRecord) {
        await plateBindingAPI.update(editingRecord.id, submitData);
        message.success('更新成功');
      } else {
        await plateBindingAPI.create(submitData);
        message.success('创建成功');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      }
    }
  };

  const columns = [
    {
      title: '车牌号',
      dataIndex: 'plate_number',
      key: 'plate_number',
    },
    {
      title: '卡号',
      dataIndex: 'card_number',
      key: 'card_number',
    },
    {
      title: '车主姓名',
      dataIndex: 'owner_name',
      key: 'owner_name',
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '有效期从',
      dataIndex: 'valid_from',
      key: 'valid_from',
    },
    {
      title: '有效期至',
      dataIndex: 'valid_to',
      key: 'valid_to',
      render: (text) => <span style={{ color: text && dayjs(text).isBefore(dayjs()) ? 'red' : 'inherit' }}>{text}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text) => (text === 'active' ? '正常' : '禁用'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Form form={searchForm} layout="inline">
        <Row gutter={16}>
          <Col>
            <Form.Item name="plate_number" label="车牌号">
              <Input placeholder="请输入车牌号" prefix={<SearchOutlined />} />
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name="status" label="状态">
              <Select placeholder="请选择状态" style={{ width: 120 }} allowClear>
                <Option value="active">正常</Option>
                <Option value="inactive">禁用</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Form>

      <div style={{ textAlign: 'right', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增绑定
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
        }}
      />

      <Modal
        title={editingRecord ? '编辑绑定' : '新增绑定'}
        open={isModalOpen}
        onOk={handleOk}
        onCancel={() => setIsModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="plate_number" label="车牌号" rules={[{ required: true, message: '请输入车牌号' }]}>
            <Input placeholder="请输入车牌号" disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item name="card_number" label="卡号" rules={[{ required: true, message: '请输入卡号' }]}>
            <Input placeholder="请输入卡号" />
          </Form.Item>
          <Form.Item name="owner_name" label="车主姓名">
            <Input placeholder="请输入车主姓名" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="valid_from" label="有效期从">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="valid_to" label="有效期至">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select>
              <Option value="active">正常</Option>
              <Option value="inactive">禁用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default PlateBinding;
