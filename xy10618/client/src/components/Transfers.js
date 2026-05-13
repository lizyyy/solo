import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, InputNumber, Space, Tag, message, Descriptions } from 'antd';
import moment from 'moment';

const Transfers = ({ packages }) => {
  const [transfers, setTransfers] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetch('/api/transfers')
      .then(res => res.json())
      .then(data => setTransfers(data));
  }, []);

  const showModal = () => setIsModalVisible(true);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const fromPkg = packages.find(p => p.id === values.from_package_id);
      const toPkg = packages.find(p => p.id === values.to_package_id);
      
      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          from_member_id: fromPkg?.member_id,
          from_member_name: fromPkg?.member_name,
          to_member_id: toPkg?.member_id,
          to_member_name: toPkg?.member_name,
          operator_id: 'U001',
          operator_name: '当前用户'
        })
      });
      
      if (response.ok) {
        const newTransfer = await response.json();
        setTransfers([newTransfer, ...transfers]);
        message.success('转课申请提交成功，等待审批');
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
      const response = await fetch(`/api/transfers/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_id: 'U001', operator_name: '当前用户' })
      });
      
      if (response.ok) {
        setTransfers(transfers.map(t => t.id === id ? { ...t, status: 'approved' } : t));
        message.success('已批准');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const reject = async (id) => {
    try {
      const response = await fetch(`/api/transfers/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_id: 'U001', operator_name: '当前用户' })
      });
      
      if (response.ok) {
        setTransfers(transfers.map(t => t.id === id ? { ...t, status: 'rejected' } : t));
        message.success('已拒绝');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '转出会员', dataIndex: 'from_member_name', key: 'from_member_name' },
    { title: '转入会员', dataIndex: 'to_member_name', key: 'to_member_name' },
    { title: '转课时数', dataIndex: 'classes_transferred', key: 'classes_transferred' },
    { title: '分成比例', dataIndex: 'commission_rate', key: 'commission_rate', render: (v) => `${(v * 100).toFixed(0)}%` },
    { title: '分成金额', dataIndex: 'commission_amount', key: 'commission_amount', render: (v) => `¥${v}` },
    { 
      title: '转出变化', 
      key: 'from_change',
      render: (_, record) => (
        <span>{record.from_old_remaining} → {record.from_new_remaining}</span>
      )
    },
    { 
      title: '转入变化', 
      key: 'to_change',
      render: (_, record) => (
        <span>{record.to_old_remaining} → {record.to_new_remaining}</span>
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
        <Button type="primary" onClick={showModal}>申请转课</Button>
      </Space>
      <Table columns={columns} dataSource={transfers} rowKey="id" />
      <Modal title="申请转课" open={isModalVisible} onOk={handleOk} onCancel={() => setIsModalVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="from_package_id" label="转出课包" rules={[{ required: true }]}>
            <Select options={packageOptions} placeholder="请选择转出课包" />
          </Form.Item>
          <Form.Item name="to_package_id" label="转入课包" rules={[{ required: true }]}>
            <Select options={packageOptions} placeholder="请选择转入课包" />
          </Form.Item>
          <Form.Item name="classes_transferred" label="转课时数" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="commission_rate" label="分成比例" rules={[{ required: true }]} initialValue={0.1}>
            <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} formatter={v => `${(v * 100).toFixed(0)}%`} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Transfers;
