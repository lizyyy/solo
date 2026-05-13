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
import { returnsAPI } from '../services/api';
import moment from 'moment';

const { Title } = Typography;
const { Option } = Select;

function Returns() {
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
      const res = await returnsAPI.getAll(params);
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
      return_date: record.return_date ? moment(record.return_date) : null
    };
    form.setFieldsValue(formData);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await returnsAPI.delete(id);
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
        return_date: values.return_date ? values.return_date.format('YYYY-MM-DD') : null
      };
      if (editingItem) {
        await returnsAPI.update(editingItem.id, submitData);
        message.success('更新成功');
      } else {
        await returnsAPI.create(submitData);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const reasonColors = {
    '客户拒收': 'red',
    '地址错误': 'orange',
    '礼品损坏': 'blue',
    '其他': 'default'
  };

  const columns = [
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
      title: '退回原因',
      dataIndex: 'return_reason',
      key: 'return_reason',
      width: 150,
      render: (reason) => (
        <Tag color={reasonColors[reason] || 'default'}>{reason}</Tag>
      )
    },
    {
      title: '退回日期',
      dataIndex: 'return_date',
      key: 'return_date',
      width: 120
    },
    {
      title: '处理人',
      dataIndex: 'handler',
      key: 'handler',
      width: 100
    },
    {
      title: '来源类型',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 100,
      render: (type) => (
        <Tag color={type === 'customer' ? 'blue' : 'green'}>
          {type === 'customer' ? '客户' : '员工'}
        </Tag>
      )
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true
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
      <Title level={3} style={{ marginBottom: 24 }}>退回入库</Title>

      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline">
          <Form.Item name="gift_type" label="礼品类型">
            <Select placeholder="请选择礼品类型" style={{ width: 150 }} allowClear>
              <Option value="商务礼品">商务礼品</Option>
              <Option value="节日礼品">节日礼品</Option>
              <Option value="纪念礼品">纪念礼品</Option>
              <Option value="促销礼品">促销礼品</Option>
            </Select>
          </Form.Item>
          <Form.Item name="handler" label="处理人">
            <Input placeholder="请输入处理人" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="source_type" label="来源类型">
            <Select placeholder="请选择来源类型" style={{ width: 120 }} allowClear>
              <Option value="customer">客户</Option>
              <Option value="employee">员工</Option>
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
            新增退回
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
        title={editingItem ? '编辑退回' : '新增退回'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
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
                name="return_reason"
                label="退回原因"
                rules={[{ required: true, message: '请选择退回原因' }]}
              >
                <Select placeholder="请选择退回原因">
                  <Option value="客户拒收">客户拒收</Option>
                  <Option value="地址错误">地址错误</Option>
                  <Option value="礼品损坏">礼品损坏</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="return_date"
                label="退回日期"
                rules={[{ required: true, message: '请选择退回日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="请选择退回日期" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="handler"
                label="处理人"
                rules={[{ required: true, message: '请输入处理人' }]}
              >
                <Input placeholder="请输入处理人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="source_type"
                label="来源类型"
                rules={[{ required: true, message: '请选择来源类型' }]}
              >
                <Select placeholder="请选择来源类型">
                  <Option value="customer">客户</Option>
                  <Option value="employee">员工</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="source_id" label="来源ID">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入来源ID" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Returns;
