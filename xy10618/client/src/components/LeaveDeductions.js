import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber, Space, Tag, message, Descriptions } from 'antd';
import moment from 'moment';

const LeaveDeductions = ({ packages }) => {
  const [deductions, setDeductions] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetch('/api/leave')
      .then(res => res.json())
      .then(data => setDeductions(data));
  }, []);

  const showModal = () => setIsModalVisible(true);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const pkg = packages.find(p => p.id === values.package_id);
      
      const response = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          member_id: pkg?.member_id,
          member_name: pkg?.member_name,
          leave_date: values.leave_date?.format('YYYY-MM-DD'),
          operator_id: 'U001',
          operator_name: '当前用户'
        })
      });
      
      if (response.ok) {
        const newDeduction = await response.json();
        setDeductions([newDeduction, ...deductions]);
        message.success('申请提交成功，等待审批');
        setIsModalVisible(false);
        form.resetFields();
      } else {
        const error = await response.json();
        message.error(error.error || '提交失败');
      }
    } catch (error) {
      message.error('提交失败');
    }
  };

  const approve = async (id) => {
    try {
      const response = await fetch(`/api/leave/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_id: 'U001', operator_name: '当前用户' })
      });
      
      if (response.ok) {
        setDeductions(deductions.map(d => d.id === id ? { ...d, status: 'approved' } : d));
        message.success('已批准');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const reject = async (id) => {
    try {
      const response = await fetch(`/api/leave/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_id: 'U001', operator_name: '当前用户' })
      });
      
      if (response.ok) {
        setDeductions(deductions.map(d => d.id === id ? { ...d, status: 'rejected' } : d));
        message.success('已拒绝');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '会员', dataIndex: 'member_name', key: 'member_name' },
    { title: '请假日期', dataIndex: 'leave_date', key: 'leave_date' },
    { title: '原因', dataIndex: 'reason', key: 'reason' },
    { title: '扣课时数', dataIndex: 'classes_deducted', key: 'classes_deducted' },
    { 
      title: '变更前后', 
      key: 'change',
      render: (_, record) => (
        <span>{record.old_remaining} → {record.new_remaining}</span>
      )
    },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status) => (
      <Tag color={status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'orange'}>
        {status === 'pending' ? '待审批' : status === 'approved' ? '已批准' : '已拒绝'}
      </Tag>
    )},
    { title: '操作', key: 'action', render: (_, record) => (
      <Space>
        {record.status === 'pending' && (
          <>
            <Button size="small" type="primary" onClick={() => approve(record.id)}>批准</Button>
            <Button size="small" danger onClick={() => reject(record.id)}>拒绝</Button>
          </>
        )}
      </Space>
    )}
  ];

  const packageOptions = packages.filter(p => p.status === 'active').map(p => ({
    label: `${p.member_name} - ${p.package_name} (剩余${p.remaining_classes}节)`,
    value: p.id
  }));

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={showModal}>申请请假扣课</Button>
      </Space>
      <Table columns={columns} dataSource={deductions} rowKey="id" />
      <Modal title="申请请假扣课" open={isModalVisible} onOk={handleOk} onCancel={() => setIsModalVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="package_id" label="选择课包" rules={[{ required: true }]}>
            <Select options={packageOptions} placeholder="请选择课包" />
          </Form.Item>
          <Form.Item name="leave_date" label="请假日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="classes_deducted" label="扣课时数" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="请假原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LeaveDeductions;
