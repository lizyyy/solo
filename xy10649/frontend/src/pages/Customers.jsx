import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  message,
  Popconfirm,
  Row,
  Col,
  Card,
  Typography,
  Tag,
  Descriptions
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons';
import { customersAPI, plansAPI } from '../services/api';

const { Title } = Typography;
const { Option } = Select;

function Customers() {
  const [data, setData] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  useEffect(() => {
    loadData();
    loadPlans();
  }, []);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await customersAPI.getAll(params);
      setData(res.data.data || []);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const res = await plansAPI.getAll();
      setPlans(res.data.data || []);
    } catch (error) {
      message.error('加载计划列表失败');
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
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await customersAPI.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await customersAPI.update(editingItem.id, values);
        message.success('更新成功');
      } else {
        await customersAPI.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleViewHistory = async (id) => {
    try {
      const res = await customersAPI.getHistory(id);
      setHistory(res.data.data || []);
      setHistoryModalVisible(true);
    } catch (error) {
      message.error('加载历史记录失败');
    }
  };

  const statusColors = {
    pending: 'orange',
    processing: 'blue',
    delivered: 'green',
    cancelled: 'red'
  };

  const statusTexts = {
    pending: '待处理',
    processing: '处理中',
    delivered: '已送达',
    cancelled: '已取消'
  };

  const columns = [
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name'
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true
    },
    {
      title: '礼品类型',
      dataIndex: 'gift_type',
      key: 'gift_type',
      width: 120
    },
    {
      title: '礼品数量',
      dataIndex: 'gift_quantity',
      key: 'gift_quantity',
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
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" icon={<HistoryOutlined />} onClick={() => handleViewHistory(record.id)}>
            历史
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
      <Title level={3} style={{ marginBottom: 24 }}>客户名单</Title>

      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline">
          <Form.Item name="customer_name" label="客户姓名">
            <Input placeholder="请输入客户姓名" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="plan_id" label="所属计划">
            <Select placeholder="请选择计划" style={{ width: 150 }} allowClear>
              {plans.map(plan => (
                <Option key={plan.id} value={plan.id}>{plan.plan_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态" style={{ width: 120 }} allowClear>
              <Option value="pending">待处理</Option>
              <Option value="processing">处理中</Option>
              <Option value="delivered">已送达</Option>
              <Option value="cancelled">已取消</Option>
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
            新增客户
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
        title={editingItem ? '编辑客户' : '新增客户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="customer_name"
            label="客户姓名"
            rules={[{ required: true, message: '请输入客户姓名' }]}
          >
            <Input placeholder="请输入客户姓名" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="电话"
                rules={[{ required: true, message: '请输入电话' }]}
              >
                <Input placeholder="请输入电话" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="plan_id" label="所属计划">
                <Select placeholder="请选择计划">
                  {plans.map(plan => (
                    <Option key={plan.id} value={plan.id}>{plan.plan_name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="address"
            label="地址"
            rules={[{ required: true, message: '请输入地址' }]}
          >
            <Input placeholder="请输入地址" />
          </Form.Item>
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
                name="gift_quantity"
                label="礼品数量"
                rules={[{ required: true, message: '请输入礼品数量' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入礼品数量" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态">
              <Option value="pending">待处理</Option>
              <Option value="processing">处理中</Option>
              <Option value="delivered">已送达</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改历史"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={800}
      >
        {history.map((item, index) => (
          <Card key={index} style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="操作类型">
                <Tag color={item.operation_type === 'create' ? 'green' : item.operation_type === 'update' ? 'blue' : 'red'}>
                  {item.operation_type === 'create' ? '创建' : item.operation_type === 'update' ? '更新' : '删除'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="操作人">{item.operator}</Descriptions.Item>
              <Descriptions.Item label="操作时间" span={2}>{item.created_at}</Descriptions.Item>
              {item.before_data && (
                <Descriptions.Item label="修改前" span={2}>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(JSON.parse(item.before_data), null, 2)}
                  </pre>
                </Descriptions.Item>
              )}
              {item.after_data && (
                <Descriptions.Item label="修改后" span={2}>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(JSON.parse(item.after_data), null, 2)}
                  </pre>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        ))}
      </Modal>
    </div>
  );
}

export default Customers;
