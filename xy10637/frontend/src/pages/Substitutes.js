import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, Input, message, Tag, Space } from 'antd';
import axios from 'axios';

const Substitutes = () => {
  const [data, setData] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    loadCaregivers();
    loadSchedules();
    loadLeaves();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get('/api/substitutes');
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

  const loadSchedules = async () => {
    try {
      const res = await axios.get('/api/schedules');
      setSchedules(res.data.filter(s => s.status === 'scheduled'));
    } catch (err) {
      message.error('加载排班失败');
    }
  };

  const loadLeaves = async () => {
    try {
      const res = await axios.get('/api/leaves');
      setLeaves(res.data.filter(l => l.status === 'pending'));
    } catch (err) {
      message.error('加载请假失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      await axios.post('/api/substitutes', values);
      message.success('创建成功');
      setVisible(false);
      loadData();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const handleApprove = async (id) => {
    try {
      await axios.put(`/api/substitutes/${id}/approve`, { approved_by: '管理员' });
      message.success('已批准');
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
    { title: '原排班日期', dataIndex: 'date', key: 'date' },
    { title: '原排班班次', dataIndex: 'shift_type', key: 'shift_type' },
    { title: '替代人员', dataIndex: 'substitute_name', key: 'substitute_name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: s => (
      <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>
    )},
    { title: '备注', dataIndex: 'remarks', key: 'remarks' },
    {
      title: '操作',
      render: (_, record) => (
        <>
          {record.status === 'pending' && (
            <Button size="small" type="primary" onClick={() => handleApprove(record.id)}>
              批准
            </Button>
          )}
        </>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => { form.resetFields(); setVisible(true); }}>
          创建替代安排
        </Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" />
      <Modal
        title="创建替代安排"
        open={visible}
        onCancel={() => setVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="original_schedule_id" label="原排班" rules={[{ required: true }]}>
            <Select>
              {schedules.map(s => (
                <Select.Option key={s.id} value={s.id}>
                  {s.date} {s.shift_type} - {s.caregiver_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="substitute_caregiver_id" label="替代人员" rules={[{ required: true }]}>
            <Select>
              {caregivers.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="leave_id" label="关联请假">
            <Select>
              {leaves.map(l => (
                <Select.Option key={l.id} value={l.id}>
                  {l.caregiver_name} - {l.start_time}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Substitutes;
