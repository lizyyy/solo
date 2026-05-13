import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Modal, Space, message, Row, Col, Tag, InputNumber } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { renewalAPI } from '../services/api';

const { Option } = Select;

const Renewal = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize]);

  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await renewalAPI.list({
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
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const submitData = { ...values, handler: '操作员' };
      await renewalAPI.create(submitData);
      message.success('续费成功');
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
      title: '交易号',
      dataIndex: 'transaction_no',
      key: 'transaction_no',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (text) => `¥${text}`,
    },
    {
      title: '支付方式',
      dataIndex: 'payment_method',
      key: 'payment_method',
    },
    {
      title: '续费月份',
      dataIndex: 'renewal_months',
      key: 'renewal_months',
      render: (text) => `${text}个月`,
    },
    {
      title: '新有效期至',
      dataIndex: 'new_valid_to',
      key: 'new_valid_to',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text) => (
        <Tag color={text === 'completed' ? 'green' : text === 'pending' ? 'orange' : 'red'}>
          {text === 'completed' ? '已完成' : text === 'pending' ? '待处理' : '失败'}
        </Tag>
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
                <Option value="completed">已完成</Option>
                <Option value="pending">待处理</Option>
                <Option value="failed">失败</Option>
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
          新增续费
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
        title="新增续费"
        open={isModalOpen}
        onOk={handleOk}
        onCancel={() => setIsModalOpen(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="plate_number" label="车牌号" rules={[{ required: true, message: '请输入车牌号' }]}>
            <Input placeholder="请输入车牌号" />
          </Form.Item>
          <Form.Item name="transaction_no" label="交易号" rules={[{ required: true, message: '请输入交易号' }]}>
            <Input placeholder="请输入交易号" />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0} prefix="¥" placeholder="请输入金额" />
          </Form.Item>
          <Form.Item name="payment_method" label="支付方式" rules={[{ required: true, message: '请选择支付方式' }]}>
            <Select placeholder="请选择支付方式">
              <Option value="wechat">微信支付</Option>
              <Option value="alipay">支付宝</Option>
              <Option value="cash">现金</Option>
            </Select>
          </Form.Item>
          <Form.Item name="renewal_months" label="续费月份" rules={[{ required: true, message: '请输入续费月份' }]}>
            <InputNumber style={{ width: '100%' }} min={1} placeholder="请输入续费月份" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default Renewal;
