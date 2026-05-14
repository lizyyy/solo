import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Space, message, Spin, Tag } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { quotaApi } from '../services/api';

const Packages = () => {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await quotaApi.getPackages();
      setPackages(res.data);
    } catch (error) {
      message.error('获取数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedPackage(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setSelectedPackage(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (selectedPackage) {
        message.info('更新功能待实现');
      } else {
        await quotaApi.createPackage(values);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      fetchData();
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
      title: '套餐名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '月度配额',
      dataIndex: 'monthlyQuota',
      key: 'monthlyQuota',
      render: (val) => val?.toLocaleString(),
    },
    {
      title: '突增阈值',
      dataIndex: 'burstThreshold',
      key: 'burstThreshold',
    },
    {
      title: '最大重试次数',
      dataIndex: 'maxRetries',
      key: 'maxRetries',
    },
    {
      title: '单价',
      dataIndex: 'pricePerCall',
      key: 'pricePerCall',
      render: (val) => `¥${val}`,
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
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增套餐
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={packages}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={selectedPackage ? '编辑套餐' : '新增套餐'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="套餐名称"
            rules={[{ required: true, message: '请输入套餐名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="monthlyQuota"
            label="月度配额"
            rules={[{ required: true, message: '请输入月度配额' }]}
          >
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item
            name="burstThreshold"
            label="突增阈值（分钟）"
            initialValue={100}
          >
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item
            name="burstWindowMinutes"
            label="突增窗口（分钟）"
            initialValue={5}
          >
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item
            name="maxRetries"
            label="最大重试次数"
            initialValue={3}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item
            name="pricePerCall"
            label="单价（元）"
            initialValue={0.01}
          >
            <InputNumber style={{ width: '100%' }} min={0} step={0.001} />
          </Form.Item>
        </Form>
      </Modal>
    </Spin>
  );
};

export default Packages;
