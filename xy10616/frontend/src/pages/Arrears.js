import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Modal, Space, message, Row, Col, Tag } from 'antd';
import { PlusOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import { arrearsAPI } from '../services/api';

const { Option } = Select;

const Arrears = () => {
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
      const res = await arrearsAPI.list({
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
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const submitData = { ...values, handler: '操作员' };

      if (editingRecord) {
        await arrearsAPI.update(editingRecord.id, submitData);
        message.success('更新成功');
      } else {
        await arrearsAPI.create(submitData);
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
      title: '账期',
      dataIndex: 'bill_month',
      key: 'bill_month',
    },
    {
      title: '欠费金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (text) => `¥${text}`,
    },
    {
      title: '已缴金额',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      render: (text) => `¥${text || 0}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text) => (
        <Tag color={text === 'paid' ? 'green' : 'red'}>{text === 'paid' ? '已缴' : '未缴'}</Tag>
      ),
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
                <Option value="unpaid">未缴</Option>
                <Option value="paid">已缴</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name="bill_month" label="账期">
              <Input placeholder="如：2024-04" style={{ width: 120 }} />
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
          新增欠费
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
        title={editingRecord ? '编辑欠费' : '新增欠费'}
        open={isModalOpen}
        onOk={handleOk}
        onCancel={() => setIsModalOpen(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="plate_number" label="车牌号" rules={[{ required: true, message: '请输入车牌号' }]}>
            <Input placeholder="请输入车牌号" disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item name="bill_month" label="账期" rules={[{ required: true, message: '请输入账期' }]}>
            <Input placeholder="如：2024-04" disabled={!!editingRecord} />
          </Form.Item>
          <Form.Item name="amount" label="欠费金额" rules={[{ required: true, message: '请输入金额' }]}>
            <Input type="number" placeholder="请输入金额" prefix="¥" />
          </Form.Item>
          {editingRecord && (
            <>
              <Form.Item name="paid_amount" label="已缴金额">
                <Input type="number" placeholder="请输入已缴金额" prefix="¥" />
              </Form.Item>
              <Form.Item name="status" label="状态" initialValue="unpaid">
                <Select>
                  <Option value="unpaid">未缴</Option>
                  <Option value="paid">已缴</Option>
                </Select>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Space>
  );
};

export default Arrears;
