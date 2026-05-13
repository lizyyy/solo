import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, Input, Space, Tag, message, Descriptions } from 'antd';
import moment from 'moment';

const Refunds = ({ packages }) => {
  const [refunds, setRefunds] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [calculated, setCalculated] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetch('/api/refunds')
      .then(res => res.json())
      .then(data => setRefunds(data));
  }, []);

  const showModal = () => setIsModalVisible(true);

  const calculateRefund = async (packageId) => {
    try {
      const response = await fetch('/api/refunds/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId, refund_reason: '临时' })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCalculated(data);
      }
    } catch (error) {
      message.error('试算失败');
    }
  };

  const handleOk = async () => {
    if (!calculated) {
      message.error('请先选择课包进行试算');
      return;
    }
    
    try {
      const values = await form.validateFields();
      
      const response = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...calculated,
          refund_reason: values.refund_reason,
          operator_id: 'U001',
          operator_name: '当前用户'
        })
      });
      
      if (response.ok) {
        const newRefund = await response.json();
        setRefunds([newRefund, ...refunds]);
        message.success('退款申请提交成功，等待审批');
        setIsModalVisible(false);
        form.resetFields();
        setCalculated(null);
      }
    } catch (error) {
      message.error('提交失败');
    }
  };

  const approve = async (id) => {
    try {
      const response = await fetch(`/api/refunds/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_id: 'U001', operator_name: '当前用户' })
      });
      
      if (response.ok) {
        setRefunds(refunds.map(r => r.id === id ? { ...r, status: 'approved' } : r));
        message.success('已批准');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const reject = async (id) => {
    try {
      const response = await fetch(`/api/refunds/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_id: 'U001', operator_name: '当前用户' })
      });
      
      if (response.ok) {
        setRefunds(refunds.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
        message.success('已拒绝');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '会员', dataIndex: 'member_name', key: 'member_name' },
    { title: '退款原因', dataIndex: 'refund_reason', key: 'refund_reason' },
    { title: '已用课时', dataIndex: 'classes_used', key: 'classes_used' },
    { title: '剩余课时', dataIndex: 'classes_remaining', key: 'classes_remaining' },
    { title: '原价', dataIndex: 'original_price', key: 'original_price', render: (v) => `¥${v}` },
    { title: '退款金额', dataIndex: 'refund_amount', key: 'refund_amount', render: (v) => `¥${v}` },
    { title: '扣款金额', dataIndex: 'deduction_amount', key: 'deduction_amount', render: (v) => `¥${v}` },
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
    label: `${p.member_name} - ${p.package_name} (剩余${p.remaining_classes}节, ¥${p.price})`,
    value: p.id
  }));

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={showModal}>申请退款</Button>
      </Space>
      <Table columns={columns} dataSource={refunds} rowKey="id" />
      <Modal title="申请退款" open={isModalVisible} onOk={handleOk} onCancel={() => { setIsModalVisible(false); setCalculated(null); }} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="package_id" label="选择课包" rules={[{ required: true }]}>
            <Select 
              options={packageOptions} 
              placeholder="请选择课包" 
              onChange={calculateRefund}
            />
          </Form.Item>
          
          {calculated && (
            <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
              <Descriptions title="退款试算结果" column={1} size="small">
                <Descriptions.Item label="已用课时">{calculated.classes_used}节</Descriptions.Item>
                <Descriptions.Item label="剩余课时">{calculated.classes_remaining}节</Descriptions.Item>
                <Descriptions.Item label="原价">¥{calculated.original_price}</Descriptions.Item>
                <Descriptions.Item label="退款金额" style={{ color: 'green', fontWeight: 'bold' }}>¥{calculated.refund_amount}</Descriptions.Item>
                <Descriptions.Item label="扣款金额" style={{ color: 'red' }}>¥{calculated.deduction_amount}</Descriptions.Item>
              </Descriptions>
            </div>
          )}
          
          <Form.Item name="refund_reason" label="退款原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Refunds;
