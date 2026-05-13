import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Popconfirm, Modal, Form, Input, Select, DatePicker } from 'antd';
import { EyeOutlined, PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

function RecallsList() {
  const [recalls, setRecalls] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();

  useEffect(() => {
    fetchRecalls();
    fetchBatches();
  }, []);

  const fetchRecalls = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/recalls');
      if (res.data.success) {
        setRecalls(res.data.data);
      }
    } catch (error) {
      message.error('获取召回列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await axios.get('/api/batches');
      if (res.data.success) {
        setBatches(res.data.data);
      }
    } catch (error) {
      message.error('获取批号列表失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'orange', text: '待处理' },
      processing: { color: 'blue', text: '处理中' },
      completed: { color: 'green', text: '已完成' },
      blocked: { color: 'red', text: '已拦截' },
      cancelled: { color: 'gray', text: '已取消' }
    };
    const info = statusMap[status] || { color: 'default', text: status };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const handleCreateBatch = async (values) => {
    try {
      await axios.post('/api/batches', {
        ...values,
        production_date: values.production_date.format('YYYY-MM-DD'),
        expiry_date: values.expiry_date.format('YYYY-MM-DD'),
        operator: 'admin'
      });
      message.success('批号创建成功');
      setBatchModalVisible(false);
      batchForm.resetFields();
      fetchBatches();
    } catch (error) {
      message.error('批号创建失败: ' + error.response?.data?.error);
    }
  };

  const handleCreateRecall = async (values) => {
    try {
      const res = await axios.post('/api/recalls', {
        ...values,
        initiator: 'admin'
      });
      if (res.data.data.status === 'blocked') {
        message.warning('召回创建但被规则拦截: ' + res.data.data.blocked_reason);
      } else {
        message.success('召回创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchRecalls();
    } catch (error) {
      message.error('召回创建失败: ' + error.response?.data?.error);
    }
  };

  const handleReview = async (id, status) => {
    try {
      await axios.post(`/api/recalls/${id}/review`, {
        status,
        reviewed_by: 'admin',
        review_reason: '人工复核通过'
      });
      message.success('复核成功');
      fetchRecalls();
    } catch (error) {
      message.error('复核失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '批号', dataIndex: 'batch_no', key: 'batch_no', width: 150 },
    { title: '耗材名称', dataIndex: 'consumable_name', key: 'consumable_name', width: 150 },
    { title: '召回原因', dataIndex: 'recall_reason', key: 'recall_reason', ellipsis: true },
    { title: '召回级别', dataIndex: 'recall_level', key: 'recall_level', width: 100,
      render: (level) => <Tag color={level === 'high' ? 'red' : level === 'medium' ? 'orange' : 'blue'}>{level}</Tag>
    },
    { title: '发起人', dataIndex: 'initiator', key: 'initiator', width: 100 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: getStatusTag },
    { title: '拦截原因', dataIndex: 'blocked_reason', key: 'blocked_reason', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Link to={`/recall/${record.id}`}>
            <Button icon={<EyeOutlined />} size="small">详情</Button>
          </Link>
          {record.status === 'blocked' && (
            <Popconfirm title="确认复核通过？" onConfirm={() => handleReview(record.id, 'processing')}>
              <Button icon={<CheckOutlined />} size="small" type="primary">复核</Button>
            </Popconfirm>
          )}
          {record.status === 'pending' && (
            <>
              <Popconfirm title="确认通过？" onConfirm={() => handleReview(record.id, 'processing')}>
                <Button icon={<CheckOutlined />} size="small" type="primary">通过</Button>
              </Popconfirm>
              <Popconfirm title="确认取消？" onConfirm={() => handleReview(record.id, 'cancelled')}>
                <Button icon={<CloseOutlined />} size="small" danger>取消</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>召回列表</h2>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setBatchModalVisible(true)}>
            创建耗材批号
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            创建召回
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={recalls}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="创建耗材批号"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        footer={null}
      >
        <Form form={batchForm} layout="vertical" onFinish={handleCreateBatch}>
          <Form.Item name="batch_no" label="批号" rules={[{ required: true }]}>
            <Input placeholder="请输入批号" />
          </Form.Item>
          <Form.Item name="consumable_name" label="耗材名称" rules={[{ required: true }]}>
            <Input placeholder="请输入耗材名称" />
          </Form.Item>
          <Form.Item name="manufacturer" label="生产厂家" rules={[{ required: true }]}>
            <Input placeholder="请输入生产厂家" />
          </Form.Item>
          <Form.Item name="production_date" label="生产日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expiry_date" label="有效期至" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <Input type="number" placeholder="请输入数量" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="创建召回通知"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateRecall}>
          <Form.Item name="batch_id" label="选择耗材批号" rules={[{ required: true }]}>
            <Select placeholder="请选择批号">
              {batches.map(batch => (
                <Option key={batch.id} value={batch.id}>
                  {batch.batch_no} - {batch.consumable_name} (效期: {dayjs(batch.expiry_date).format('YYYY-MM-DD')})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="recall_reason" label="召回原因" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="请输入召回原因" />
          </Form.Item>
          <Form.Item name="recall_level" label="召回级别" rules={[{ required: true }]}>
            <Select placeholder="请选择召回级别">
              <Option value="high">高级</Option>
              <Option value="medium">中级</Option>
              <Option value="low">低级</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
              创建召回
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RecallsList;
