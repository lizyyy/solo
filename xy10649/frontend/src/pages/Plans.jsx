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
  Tag,
  Descriptions
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons';
import { plansAPI } from '../services/api';
import moment from 'moment';

const { Title } = Typography;
const { Option } = Select;

function Plans() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const res = await plansAPI.getAll(params);
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
      start_date: record.start_date ? moment(record.start_date) : null,
      end_date: record.end_date ? moment(record.end_date) : null
    };
    form.setFieldsValue(formData);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await plansAPI.delete(id);
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
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null
      };
      if (editingItem) {
        await plansAPI.update(editingItem.id, submitData);
        message.success('更新成功');
      } else {
        await plansAPI.create(submitData);
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
      const res = await plansAPI.getHistory(id);
      setHistory(res.data.data || []);
      setHistoryModalVisible(true);
    } catch (error) {
      message.error('加载历史记录失败');
    }
  };

  const columns = [
    {
      title: '计划名称',
      dataIndex: 'plan_name',
      key: 'plan_name'
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 120
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 120
    },
    {
      title: '礼品类型',
      dataIndex: 'gift_type',
      key: 'gift_type',
      width: 120
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 100
    },
    {
      title: '预算',
      dataIndex: 'budget',
      key: 'budget',
      width: 100
    },
    {
      title: '责任人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'draft' ? 'orange' : 'green'}>
          {status === 'draft' ? '草稿' : '已发布'}
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
      <Title level={3} style={{ marginBottom: 24 }}>活动计划</Title>

      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline">
          <Form.Item name="plan_name" label="计划名称">
            <Input placeholder="请输入计划名称" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态" style={{ width: 120 }} allowClear>
              <Option value="draft">草稿</Option>
              <Option value="published">已发布</Option>
            </Select>
          </Form.Item>
          <Form.Item name="responsible_person" label="责任人">
            <Input placeholder="请输入责任人" style={{ width: 120 }} />
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
            新增计划
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
        title={editingItem ? '编辑计划' : '新增计划'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="plan_name"
            label="计划名称"
            rules={[{ required: true, message: '请输入计划名称' }]}
          >
            <Input placeholder="请输入计划名称" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="start_date"
                label="开始日期"
                rules={[{ required: true, message: '请选择开始日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择开始日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="end_date"
                label="结束日期"
                rules={[{ required: true, message: '请选择结束日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择结束日期" />
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
                name="total_quantity"
                label="总数量"
                rules={[{ required: true, message: '请输入总数量' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入总数量" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="budget"
                label="预算"
                rules={[{ required: true, message: '请输入预算' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入预算" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="responsible_person"
                label="责任人"
                rules={[{ required: true, message: '请输入责任人' }]}
              >
                <Input placeholder="请输入责任人" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="状态">
            <Select placeholder="请选择状态">
              <Option value="draft">草稿</Option>
              <Option value="published">已发布</Option>
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

export default Plans;
