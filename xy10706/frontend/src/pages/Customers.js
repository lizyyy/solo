import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Spin, Tag } from 'antd';
import { PlusOutlined, EditOutlined, GiftOutlined } from '@ant-design/icons';
import { quotaApi } from '../services/api';

const Customers = () => {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [customerPackages, setCustomerPackages] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPackageModalVisible, setIsPackageModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form] = Form.useForm();
  const [packageForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [customersRes, packagesRes] = await Promise.all([
        quotaApi.getCustomers(),
        quotaApi.getPackages(),
      ]);
      setCustomers(customersRes.data);
      setPackages(packagesRes.data);
    } catch (error) {
      message.error('获取数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerPackages = async (customerId) => {
    try {
      const res = await quotaApi.getCustomerPackages(customerId);
      setCustomerPackages(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAdd = () => {
    setSelectedCustomer(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setSelectedCustomer(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (selectedCustomer) {
        message.info('更新功能待实现');
      } else {
        await quotaApi.createCustomer(values);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAssignPackage = (record) => {
    setSelectedCustomer(record);
    packageForm.resetFields();
    fetchCustomerPackages(record.id);
    setIsPackageModalVisible(true);
  };

  const handleAssignPackageOk = async () => {
    try {
      const values = await packageForm.validateFields();
      await quotaApi.assignPackage({
        ...values,
        CustomerId: selectedCustomer.id,
      });
      message.success('套餐分配成功');
      setIsPackageModalVisible(false);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      active: { text: '活跃', color: 'success' },
      suspended: { text: '暂停', color: 'warning' },
      terminated: { text: '终止', color: 'error' },
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
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      key: 'apiKey',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<GiftOutlined />}
            onClick={() => handleAssignPackage(record)}
          >
            分配套餐
          </Button>
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
          新增客户
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={customers}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={selectedCustomer ? '编辑客户' : '新增客户'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="客户名称"
            rules={[{ required: true, message: '请输入客户名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, message: '请输入邮箱' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[{ required: true, message: '请输入API Key' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="分配套餐"
        open={isPackageModalVisible}
        onOk={handleAssignPackageOk}
        onCancel={() => setIsPackageModalVisible(false)}
      >
        <Form form={packageForm} layout="vertical">
          <Form.Item
            name="PackageId"
            label="选择套餐"
            rules={[{ required: true, message: '请选择套餐' }]}
          >
            <select style={{ width: '100%', padding: '8px' }}>
              {packages.map(pkg => (
                <option key={pkg.id} value={pkg.id}>{pkg.name} - 月度配额: {pkg.monthlyQuota}</option>
              ))}
            </select>
          </Form.Item>
        </Form>

        {customerPackages.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4>已分配套餐:</h4>
            <ul>
              {customerPackages.map(cp => (
                <li key={cp.id}>
                  {cp.Package?.name} - 已用: {cp.usedQuota} / {cp.Package?.monthlyQuota}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </Spin>
  );
};

export default Customers;
