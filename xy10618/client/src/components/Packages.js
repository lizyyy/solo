import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, Space, Tag, message } from 'antd';
import moment from 'moment';

const Packages = ({ packages, setPackages }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const showModal = () => setIsModalVisible(true);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const response = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          purchase_date: values.purchase_date?.toISOString(),
          expire_date: values.expire_date?.toISOString(),
          operator_id: 'U001',
          operator_name: '当前用户'
        })
      });
      
      if (response.ok) {
        const newPackage = await response.json();
        setPackages([newPackage, ...packages]);
        message.success('课包创建成功');
        setIsModalVisible(false);
        form.resetFields();
      }
    } catch (error) {
      message.error('创建课包失败');
    }
  };

  const columns = [
    { title: '会员姓名', dataIndex: 'member_name', key: 'member_name' },
    { title: '会员ID', dataIndex: 'member_id', key: 'member_id' },
    { title: '课包名称', dataIndex: 'package_name', key: 'package_name' },
    { title: '总课时', dataIndex: 'total_classes', key: 'total_classes' },
    { title: '剩余课时', dataIndex: 'remaining_classes', key: 'remaining_classes' },
    { title: '价格', dataIndex: 'price', key: 'price', render: (v) => `¥${v}` },
    { title: '购买日期', dataIndex: 'purchase_date', key: 'purchase_date', render: (v) => moment(v).format('YYYY-MM-DD') },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status) => (
      <Tag color={status === 'active' ? 'green' : status === 'refunded' ? 'red' : 'orange'}>
        {status === 'active' ? '有效' : status === 'refunded' ? '已退款' : '已过期'}
      </Tag>
    )}
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={showModal}>新建课包</Button>
      </Space>
      <Table columns={columns} dataSource={packages} rowKey="id" />
      <Modal title="新建课包" open={isModalVisible} onOk={handleOk} onCancel={() => setIsModalVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="member_id" label="会员ID" rules={[{ required: true }]}>
            <Input placeholder="例如：M001" />
          </Form.Item>
          <Form.Item name="member_name" label="会员姓名" rules={[{ required: true }]}>
            <Input placeholder="例如：张三" />
          </Form.Item>
          <Form.Item name="package_name" label="课包名称" rules={[{ required: true }]}>
            <Input placeholder="例如：高级私教课包" />
          </Form.Item>
          <Form.Item name="total_classes" label="总课时" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="price" label="价格" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item name="purchase_date" label="购买日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expire_date" label="过期日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Packages;
