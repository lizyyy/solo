import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, DatePicker, message, Tag } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

const Leaves = () => {
  const [data, setData] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    loadCaregivers();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get('/api/leaves');
      setData(res.data);
    } catch (err) {
      message.error('加载失败');
    }
  };

  const loadCaregivers = async () => {
    try {
      const res = await axios.get('/api/caregivers');
      setCaregivers(res.data);
    } catch (err) {
      message.error('加载陪护人员失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      await axios.post('/api/leaves', {
        ...values,
        start_time: values.range[0].format('YYYY-MM-DD HH:mm:ss'),
        end_time: values.range[1].format('YYYY-MM-DD HH:mm:ss')
      });
      message.success('创建成功');
      setVisible(false);
      loadData();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const handleApprove = async (id) => {
    try {
      await axios.put(`/api/leaves/${id}/approve`, { approved_by: '管理员' });
      message.success('已批准');
      loadData();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleReject = async (id) => {
    try {
      await axios.put(`/api/leaves/${id}/reject`, {});
      message.success('已驳回');
      loadData();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const statusMap = {
    pending: { text: '待审批', color: 'orange' },
    approved: { text: '已批准', color: 'green' },
    rejected: { text: '已驳回', color: 'red' }
  };

  const columns = [
    { title: '陪护人员', dataIndex: 'caregiver_name', key: 'caregiver_name' },
    { title: '请假类型', dataIndex: 'leave_type', key: 'leave_type' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time' },
    { title: '结束时间', dataIndex: 'end_time', key: 'end_time' },
    { title: '原因', dataIndex: 'reason', key: 'reason' },
    { title: '状态', dataIndex: 'status', key: 'status', render: s => (
      <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>
    )},
    {
      title: '操作',
      render: (_, record) => (
        <>
          {record.status === 'pending' && (
            <>
              <Button size="small" type="primary" onClick={() => handleApprove(record.id)}>
                批准
              </Button>
              <Button size="small" danger onClick={() => handleReject(record.id)}>
                驳回
              </Button>
            </>
          )}
        </>
      ),
    },
  ];

  return (
    <div>
      <Button type="primary" onClick={() => { form.resetFields(); setVisible(true); }}>
        申请请假
      </Button>
      <Table columns={columns} dataSource={data} rowKey="id" style={{ marginTop: 16 }} />
      <Modal
        title="申请请假"
        open={visible}
        onCancel={() => setVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="caregiver_id" label="陪护人员" rules={[{ required: true }]}>
            <Select>
              {caregivers.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="leave_type" label="请假类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="sick">病假</Select.Option>
              <Select.Option value="personal">事假</Select.Option>
              <Select.Option value="annual">年假</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="range" label="时间范围" rules={[{ required: true }]}>
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="请假原因">
            <Select />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Leaves;
