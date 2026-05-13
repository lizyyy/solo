import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Space,
  message,
  Popconfirm,
  Row,
  Col,
  Card,
  Typography,
  Tag
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { claimsAPI } from '../services/api';
import moment from 'moment';

const { Title } = Typography;
const { Option } = Select;

function Claims() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await claimsAPI.getAll(params);
      setData(res.data.data || []);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    loadData(values);
  };

  const handleReset = () => {
    searchForm.resetFields();
    loadData();
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    const formData = {
      ...record,
      claim_date: record.claim_date ? moment(record.claim_date) : null
    };
    form.setFieldsValue(formData);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await claimsAPI.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData = {
        ...values,
        claim_date: values.claim_date ? values.claim_date.format('YYYY-MM-DD') : null
      };
      if (editingItem) {
        await claimsAPI.update(editingItem.id, submitData);
        message.success('更新成功');
      } else {
        await claimsAPI.create(submitData);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const statusColors = {
    pending: 'orange',
    approved: 'green',
    rejected: 'red'
  };

  const statusTexts = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已拒绝'
  };

  const columns = [
    {
      title: '员工姓名',
      dataIndex: 'employee_name',
      key: 'employee_name'
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120
    },
    {
      title: '礼品类型',
      dataIndex: 'gift_type',
      key: 'gift_type',
      width: 120
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80
    },
    {
      title: '领用日期',
      dataIndex: 'claim_date',
      key: 'claim_date',
      width: 120
    },
    {
      title: '用途',
      dataIndex: 'purpose',
      key: 'purpose',
      ellipsis: true
    },
    {
      title: '审批人',
      dataIndex: 'approver',
      key: 'approver',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusColors[status] || 'default'}>
          {statusTexts[status] || status}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>员工领用</Title>

      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline">
          <Form.Item name="employee_name" label="员工姓名">
            <Input placeholder="请输入员工姓名" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="请输入部门" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态" style={{ width: 120 }} allowClear>
              <Option value="pending">待审批</Option>
              <Option value="approved">已通过</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增领用
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑领用' : '新增领用'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="employee_name"
                label="员工姓名"
                rules={[{ required: true, message: '请输入员工姓名' }]}
              >
                <Input placeholder="请输入员工姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="department"
                label="部门"
                rules={[{ required: true, message: '请输入部门' }]}
              >
                <Input placeholder="请输入部门" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="gift_type"
                label="礼品类型"
                rules={[{ required: true, message: '请选择礼品类型' }]}
              >
                <Select placeholder="请选择礼品类型">
                  <Option value="商务礼品">商务礼品</Option>
                  <Option value="节日礼品">节日礼品</Option>
                  <Option value="纪念礼品">纪念礼品</Option>
                  <Option value="促销礼品">促销礼品</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label="数量"
                rules={[{ required: true, message: '请输入数量' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入数量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="claim_date"
                label="领用日期"
                rules={[{ required: true, message: '请选择领用日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择领用日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="approver"
                label="审批人"
              >
                <Input placeholder="请输入审批人" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="purpose"
            label="用途"
            rules={[{ required: true, message: '请输入用途' }]}
          >
            <Input placeholder="请输入用途" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态">
              <Option value="pending">待审批</Option>
              <Option value="approved">已通过</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Claims;
