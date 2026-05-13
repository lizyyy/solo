import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Input, Select, Modal, Space, message, Row, Col, Tag } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { blacklistAPI } from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

const Blacklist = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingRecord, setReviewingRecord] = useState(null);
  const [addForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [searchForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize]);

  const fetchData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await blacklistAPI.list({
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
    addForm.resetFields();
    setIsAddModalOpen(true);
  };

  const handleAddOk = async () => {
    try {
      const values = await addForm.validateFields();
      const submitData = { ...values, created_by: '管理员' };
      await blacklistAPI.add(submitData);
      message.success('加入黑名单成功');
      setIsAddModalOpen(false);
      fetchData();
    } catch (error) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      }
    }
  };

  const handleReview = (record) => {
    setReviewingRecord(record);
    reviewForm.resetFields();
    setIsReviewModalOpen(true);
  };

  const handleReviewOk = async () => {
    try {
      const values = await reviewForm.validateFields();
      await blacklistAPI.review(reviewingRecord.id, { reviewed_by: '管理员', ...values });
      message.success('黑名单解除复核成功');
      setIsReviewModalOpen(false);
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
      title: '加入原因',
      dataIndex: 'reason',
      key: 'reason',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text) => (
        <Tag color={text === 'active' ? 'red' : 'green'}>
          {text === 'active' ? '有效' : '已解除'}
        </Tag>
      ),
    },
    {
      title: '添加人',
      dataIndex: 'created_by',
      key: 'created_by',
    },
    {
      title: '添加时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) =>
        record.status === 'active' && (
          <Button type="link" onClick={() => handleReview(record)}>
            解除复核
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
                <Option value="active">有效</Option>
                <Option value="inactive">已解除</Option>
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
          加入黑名单
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
        title="加入黑名单"
        open={isAddModalOpen}
        onOk={handleAddOk}
        onCancel={() => setIsAddModalOpen(false)}
        width={500}
      >
        <Form form={addForm} layout="vertical">
          <Form.Item name="plate_number" label="车牌号" rules={[{ required: true, message: '请输入车牌号' }]}>
            <Input placeholder="请输入车牌号" />
          </Form.Item>
          <Form.Item name="reason" label="加入原因" rules={[{ required: true, message: '请输入加入原因' }]}>
            <TextArea rows={4} placeholder="请输入加入原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="黑名单解除复核"
        open={isReviewModalOpen}
        onOk={handleReviewOk}
        onCancel={() => setIsReviewModalOpen(false)}
        width={500}
      >
        <Form form={reviewForm} layout="vertical">
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontWeight: 'bold' }}>车牌号：</span>
            {reviewingRecord?.plate_number}
          </div>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontWeight: 'bold' }}>加入原因：</span>
            {reviewingRecord?.reason}
          </div>
          <Form.Item name="remarks" label="复核备注">
            <TextArea rows={4} placeholder="请输入复核备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default Blacklist;
