import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, message, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Schedules = () => {
  const [data, setData] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [wardDemands, setWardDemands] = useState([]);
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    loadCaregivers();
    loadWardDemands();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get('/api/schedules');
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

  const loadWardDemands = async () => {
    try {
      const res = await axios.get('/api/ward-demands');
      setWardDemands(res.data.filter(d => d.status === 'pending'));
    } catch (err) {
      message.error('加载病区需求失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      await axios.post('/api/schedules', values);
      message.success('创建成功');
      setVisible(false);
      loadData();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await axios.put(`/api/schedules/${id}/status`, { status });
      message.success('状态更新成功');
      loadData();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const statusMap = {
    scheduled: { text: '已排班', color: 'blue' },
    in_progress: { text: '进行中', color: 'orange' },
    completed: { text: '已完成', color: 'green' },
    cancelled: { text: '已取消', color: 'red' }
  };

  const columns = [
    { title: '病区', dataIndex: 'ward_name', key: 'ward_name' },
    { title: '陪护人员', dataIndex: 'caregiver_name', key: 'caregiver_name' },
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '班次', dataIndex: 'shift_type', key: 'shift_type' },
    { title: '工时', dataIndex: 'actual_hours', key: 'actual_hours' },
    { title: '状态', dataIndex: 'status', key: 'status', render: s => (
      <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>
    )},
    {
      title: '操作',
      render: (_, record) => (
        <>
          <Button size="small" onClick={() => navigate(`/schedules/${record.id}`)}>
            详情
          </Button>
          {record.status === 'scheduled' && (
            <Button size="small" onClick={() => handleStatusChange(record.id, 'in_progress')}>
              开始
            </Button>
          )}
          {record.status === 'in_progress' && (
            <Button size="small" onClick={() => handleStatusChange(record.id, 'completed')}>
              完成
            </Button>
          )}
        </>
      ),
    },
  ];

  const shiftOptions = [
    { value: 'morning', label: '早班' },
    { value: 'afternoon', label: '下午班' },
    { value: 'night', label: '夜班' }
  ];

  return (
    <div>
      <Button type="primary" onClick={() => { form.resetFields(); setVisible(true); }}>
        新建排班
      </Button>
      <Table columns={columns} dataSource={data} rowKey="id" style={{ marginTop: 16 }} />
      <Modal
        title="新建排班"
        open={visible}
        onCancel={() => setVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="ward_demand_id" label="病区需求" rules={[{ required: true }]}>
            <Select>
              {wardDemands.map(d => (
                <Select.Option key={d.id} value={d.id}>
                  {d.ward_name} - {d.date} - {d.shift_type}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="caregiver_id" label="陪护人员" rules={[{ required: true }]}>
            <Select>
              {caregivers.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true }]}>
            <Select />
          </Form.Item>
          <Form.Item name="shift_type" label="班次" rules={[{ required: true }]}>
            <Select options={shiftOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Schedules;
