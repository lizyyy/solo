import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
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
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { exceptionsAPI } from '../services/api';

const { Title } = Typography;
const { Option } = Select;

function Exceptions() {
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
      const res = await exceptionsAPI.getAll(params);
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
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await exceptionsAPI.delete(id);
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
        await exceptionsAPI.update(editingItem.id, values);
        message.success('更新成功');
      } else {
        await exceptionsAPI.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const typeColors = {
    '库存异常': 'red',
    '计划异常': 'orange',
    '客户异常': 'blue',
    '领用异常': 'purple',
    '快递异常': 'cyan'
  };

  const statusColors = {
    pending: 'orange',
    resolved: 'green'
  };

  const statusTexts = {
    pending: '待处理',
    resolved: '已处理'
  };

  const columns = [
    {
      title: '异常类型',
      dataIndex: 'exception_type',
      key: 'exception_type',
      width: 120,
      render: (type) => (
        <Tag color={typeColors[type] || 'default'}>{type}</Tag>
      )
    },
    {
      title: '相关模块',
      dataIndex: 'related_module',
      key: 'related_module',
      width: 100
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '修改前值',
      dataIndex: 'before_value',
      key: 'before_value',
      width: 100
    },
    {
      title: '修改后值',
      dataIndex: 'after_value',
      key: 'after_value',
      width: 100
    },
    {
      title: '处理人',
      dataIndex: 'handler',
      key: 'handler',
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
            处理
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
      <Title level={3} style={{ marginBottom: 24 }}>异常看板</Title>

      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline">
          <Form.Item name="exception_type" label="异常类型">
            <Select placeholder="请选择类型" style={{ width: 150 }} allowClear>
              <Option value="库存异常">库存异常</Option>
              <Option value="计划异常">计划异常</Option>
              <Option value="客户异常">客户异常</Option>
              <Option value="领用异常">领用异常</Option>
              <Option value="快递异常">快递异常</Option>
            </Select>
          </Form.Item>
          <Form.Item name="related_module" label="相关模块">
            <Select placeholder="请选择模块" style={{ width: 120 }} allowClear>
              <Option value="inventory">礼品库存</Option>
              <Option value="plans">活动计划</Option>
              <Option value="customers">客户名单</Option>
              <Option value="claims">员工领用</Option>
              <Option value="express">快递单号</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态" style={{ width: 120 }} allowClear>
              <Option value="pending">待处理</Option>
              <Option value="resolved">已处理</Option>
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
            新增异常
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
        title={editingItem ? '处理异常' : '新增异常'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="exception_type"
                label="异常类型"
                rules={[{ required: true, message: '请选择异常类型' }]}
              >
                <Select placeholder="请选择异常类型">
                  <Option value="库存异常">库存异常</Option>
                  <Option value="计划异常">计划异常</Option>
                  <Option value="客户异常">客户异常</Option>
                  <Option value="领用异常">领用异常</Option>
                  <Option value="快递异常">快递异常</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="related_module"
                label="相关模块"
                rules={[{ required: true, message: '请选择相关模块' }]}
              >
                <Select placeholder="请选择相关模块">
                  <Option value="inventory">礼品库存</Option>
                  <Option value="plans">活动计划</Option>
                  <Option value="customers">客户名单</Option>
                  <Option value="claims">员工领用</Option>
                  <Option value="express">快递单号</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="reason"
            label="原因"
            rules={[{ required: true, message: '请输入原因' }]}
          >
            <Input.TextArea rows={2} placeholder="请输入异常原因" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="before_value" label="修改前值">
                <Input placeholder="请输入修改前值" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="after_value" label="修改后值">
                <Input placeholder="请输入修改后值" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="handler" label="处理人">
                <Input placeholder="请输入处理人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select placeholder="请选择状态">
                  <Option value="pending">待处理</Option>
                  <Option value="resolved">已处理</Option>
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

export default Exceptions;
