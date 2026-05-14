import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Space, message, Spin, Tag, Select, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, SyncOutlined } from '@ant-design/icons';
import { quotaApi } from '../services/api';

const { Option } = Select;

const Endpoints = () => {
  const [loading, setLoading] = useState(true);
  const [endpoints, setEndpoints] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRecalculateModalVisible, setIsRecalculateModalVisible] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [form] = Form.useForm();
  const [recalculateForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await quotaApi.getEndpoints();
      setEndpoints(res.data);
    } catch (error) {
      message.error('获取数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedEndpoint(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setSelectedEndpoint(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (selectedEndpoint) {
        message.info('更新功能待实现');
      } else {
        await quotaApi.createEndpoint(values);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleRecalculate = async () => {
    try {
      const values = await recalculateForm.validateFields();
      await quotaApi.recalculateRecords(values);
      message.success('重新计算成功');
      setIsRecalculateModalVisible(false);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      active: { text: '活跃', color: 'success' },
      deprecated: { text: '已弃用', color: 'default' },
    };
    const config = statusMap[status] || { text: status, color: 'default' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'HTTP方法',
      dataIndex: 'method',
      key: 'method',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '调用成本',
      dataIndex: 'costPerCall',
      key: 'costPerCall',
    },
    {
      title: '幂等',
      dataIndex: 'isIdempotent',
      key: 'isIdempotent',
      render: (val) => val ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增接口
          </Button>
          <Button icon={<SyncOutlined />} onClick={() => setIsRecalculateModalVisible(true)}>
            重新计算记录
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={endpoints}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={selectedEndpoint ? '编辑接口' : '新增接口'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="method"
                label="HTTP方法"
                rules={[{ required: true, message: '请选择HTTP方法' }]}
                initialValue="GET"
              >
                <Select>
                  <Option value="GET">GET</Option>
                  <Option value="POST">POST</Option>
                  <Option value="PUT">PUT</Option>
                  <Option value="DELETE">DELETE</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="path"
                label="路径"
                rules={[{ required: true, message: '请输入路径' }]}
              >
                <Input placeholder="/api/v1/example" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="costPerCall"
                label="调用成本"
                initialValue={1}
              >
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
              name="isIdempotent"
              label="是否幂等"
              valuePropName="checked"
              initialValue={false}
            >
              <Select>
                <Option value={true}>是</Option>
                <Option value={false}>否</Option>
              </Select>
            </Form.Item>
          </Col>
        </Form>
      </Modal>

      <Modal
        title="重新计算记录"
        open={isRecalculateModalVisible}
        onOk={handleRecalculate}
        onCancel={() => setIsRecalculateModalVisible(false)}
      >
        <p style={{ marginBottom: 16 }}>
          当接口路径发生变化时，重新计算相关的调用记录配额消耗。
        </p>
        <Form form={recalculateForm} layout="vertical">
          <Form.Item
            name="oldPath"
            label="原路径"
            rules={[{ required: true, message: '请输入原路径' }]}
          >
            <Select placeholder="选择原接口路径">
              {endpoints.map(ep => (
                <Option key={ep.id} value={ep.path}>{ep.method} {ep.path}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="newPath"
            label="新路径"
            rules={[{ required: true, message: '请输入新路径' }]}
          >
            <Select placeholder="选择新接口路径">
              {endpoints.map(ep => (
                <Option key={ep.id} value={ep.path}>{ep.method} {ep.path}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="method"
            label="HTTP方法"
            rules={[{ required: true, message: '请选择HTTP方法' }]}
            initialValue="GET"
          >
            <Select>
              <Option value="GET">GET</Option>
              <Option value="POST">POST</Option>
              <Option value="PUT">PUT</Option>
              <Option value="DELETE">DELETE</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Spin>
  );
};

export default Endpoints;
