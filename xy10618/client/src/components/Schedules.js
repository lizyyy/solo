import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, DatePicker, TimePicker, Space, Tag, message } from 'antd';
import moment from 'moment';

const Schedules = ({ packages }) => {
  const [schedules, setSchedules] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetch('/api/schedules')
      .then(res => res.json())
      .then(data => setSchedules(data));
  }, []);

  const showModal = () => setIsModalVisible(true);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const pkg = packages.find(p => p.id === values.package_id);
      
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          member_id: pkg?.member_id,
          member_name: pkg?.member_name,
          schedule_date: values.schedule_date?.format('YYYY-MM-DD'),
          start_time: values.start_time?.format('HH:mm'),
          end_time: values.end_time?.format('HH:mm'),
          operator_id: 'U001',
          operator_name: '当前用户'
        })
      });
      
      if (response.ok) {
        const newSchedule = await response.json();
        setSchedules([newSchedule, ...schedules]);
        message.success('排班创建成功');
        setIsModalVisible(false);
        form.resetFields();
      } else {
        const error = await response.json();
        message.error(error.error || '创建失败');
      }
    } catch (error) {
      message.error('创建排班失败');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const response = await fetch(`/api/schedules/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, operator_id: 'U001', operator_name: '当前用户' })
      });
      
      if (response.ok) {
        setSchedules(schedules.map(s => s.id === id ? { ...s, status } : s));
        message.success('状态更新成功');
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const columns = [
    { title: '教练', dataIndex: 'coach_name', key: 'coach_name' },
    { title: '会员', dataIndex: 'member_name', key: 'member_name' },
    { title: '日期', dataIndex: 'schedule_date', key: 'schedule_date' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time' },
    { title: '结束时间', dataIndex: 'end_time', key: 'end_time' },
    { title: '备注', dataIndex: 'notes', key: 'notes' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status) => (
      <Tag color={status === 'completed' ? 'green' : status === 'cancelled' ? 'red' : 'blue'}>
        {status === 'scheduled' ? '已排课' : status === 'completed' ? '已完成' : '已取消'}
      </Tag>
    )},
    { title: '操作', key: 'action', render: (_, record) => (
      <Space>
        {record.status === 'scheduled' && (
          <>
            <Button size="small" type="primary" onClick={() => updateStatus(record.id, 'completed')}>
              完成消课
            </Button>
            <Button size="small" danger onClick={() => updateStatus(record.id, 'cancelled')}>
              取消
            </Button>
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
        <Button type="primary" onClick={showModal}>新建排班</Button>
      </Space>
      <Table columns={columns} dataSource={schedules} rowKey="id" />
      <Modal title="新建排班" open={isModalVisible} onOk={handleOk} onCancel={() => setIsModalVisible(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="coach_id" label="教练ID" rules={[{ required: true }]}>
            <Input placeholder="例如：C001" />
          </Form.Item>
          <Form.Item name="coach_name" label="教练姓名" rules={[{ required: true }]}>
            <Input placeholder="例如：王教练" />
          </Form.Item>
          <Form.Item name="package_id" label="选择课包" rules={[{ required: true }]}>
            <Select options={packageOptions} placeholder="请选择课包" />
          </Form.Item>
          <Form.Item name="schedule_date" label="排班日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="start_time" label="开始时间" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_time" label="结束时间" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Schedules;
