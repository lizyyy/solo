import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
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
import { expressAPI, customersAPI } from '../services/api';
import moment from 'moment';

const { Title } = Typography;
const { Option } = Select;

function Express() {
  const [data, setData] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  useEffect(() => {
    loadData();
    loadCustomers();
  }, []);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await expressAPI.getAll(params);
      setData(res.data.data || []);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await customersAPI.getAll();
      setCustomers(res.data.data || []);
    } catch (error) {
      message.error('加载客户列表失败');
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
      send_date: record.send_date ? moment(record.send_date) : null,
      receive_date: record.receive_date ? moment(record.receive_date) : null
    };
    form.setFieldsValue(formData);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await expressAPI.delete(id);
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
        send_date: values.send_date ? values.send_date.format('YYYY-MM-DD') : null,
        receive_date: values.receive_date ? values.receive_date.format('YYYY-MM-DD') : null
      };
      if (editingItem) {
        await expressAPI.update(editingItem.id, submitData);
        message.success('更新成功');
      } else {
        await expressAPI.create(submitData);
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
    shipped: 'blue',
    delivered: 'green',
    returned: 'red'
  };

  const statusTexts = {
    pending: '待发货',
    shipped: '已发货',
    delivered: '已签收',
    returned: '已退回'
  };

  const columns = [
    {
      title: '快递单号',
      dataIndex: 'tracking_number',
      key: 'tracking_number'
    },
    {
      title: '快递公司',
      dataIndex: 'express_company',
      key: 'express_company',
      width: 120
    },
    {
      title: '发件人',
      dataIndex: 'sender',
      key: 'sender',
      width: 100
    },
    {
      title: '发件日期',
      dataIndex: 'send_date',
      key: 'send_date',
      width: 120
    },
    {
      title: '收件日期',
      dataIndex: 'receive_date',
      key: 'receive_date',
      width: 120
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
      <Title level={3} style={{ marginBottom: 24 }}>快递单号</Title>

      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline">
          <Form.Item name="tracking_number" label="快递单号">
            <Input placeholder="请输入快递单号" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="customer_id" label="客户">
            <Select placeholder="请选择客户" style={{ width: 150 }} allowClear>
              {customers.map(customer => (
                <Option key={customer.id} value={customer.id}>{customer.customer_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态" style={{ width: 120 }} allowClear>
              <Option value="pending">待发货</Option>
              <Option value="shipped">已发货</Option>
              <Option value="delivered">已签收</Option>
              <Option value="returned">已退回</Option>
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
            新增快递
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
        title={editingItem ? '编辑快递' : '新增快递'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="tracking_number"
            label="快递单号"
            rules={[{ required: true, message: '请输入快递单号' }]}
          >
            <Input placeholder="请输入快递单号" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="express_company"
                label="快递公司"
                rules={[{ required: true, message: '请输入快递公司' }]}
              >
                <Input placeholder="请输入快递公司" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="customer_id" label="客户">
                <Select placeholder="请选择客户">
                  {customers.map(customer => (
                    <Option key={customer.id} value={customer.id}>{customer.customer_name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sender"
                label="发件人"
                rules={[{ required: true, message: '请输入发件人' }]}
              >
                <Input placeholder="请输入发件人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="send_date" label="发件日期">
                <DatePicker style={{ width: '100%' }} placeholder="请选择发件日期" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="receive_date" label="收件日期">
                <DatePicker style={{ width: '100%' }} placeholder="请选择收件日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select placeholder="请选择状态">
                  <Option value="pending">待发货</Option>
                  <Option value="shipped">已发货</Option>
                  <Option value="delivered">已签收</Option>
                  <Option value="returned">已退回</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Express;
