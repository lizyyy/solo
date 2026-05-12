import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, TimePicker, message, Tag, Typography, Select } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Title, Text } = Typography;
const { Option } = Select;

function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchSessions();
    fetchClasses();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      message.error('获取直播场次失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await fetch('/api/classes');
      const data = await response.json();
      setClasses(data);
    } catch (error) {
      console.error('获取班级列表失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingSession(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingSession(record);
    form.setFieldsValue({
      ...record,
      session_date: moment(record.session_date),
      start_time: moment(record.start_time, 'HH:mm:ss'),
      end_time: moment(record.end_time, 'HH:mm:ss'),
      replay_expiry_date: record.replay_expiry_date ? moment(record.replay_expiry_date) : null
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData = {
        ...values,
        session_date: values.session_date.format('YYYY-MM-DD'),
        start_time: values.start_time.format('HH:mm:ss'),
        end_time: values.end_time.format('HH:mm:ss'),
        replay_expiry_date: values.replay_expiry_date ? values.replay_expiry_date.format('YYYY-MM-DD') : null
      };

      let response;
      if (editingSession) {
        response = await fetch(`/api/sessions/${editingSession.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData)
        });
      } else {
        response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData)
        });
      }

      if (response.ok) {
        message.success(editingSession ? '更新直播场次成功' : '创建直播场次成功');
        setModalVisible(false);
        fetchSessions();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '场次标题', dataIndex: 'title', key: 'title', width: 200 },
    { title: '所属班级', dataIndex: 'class_name', key: 'class_name', width: 180 },
    { title: '课程名称', dataIndex: 'course_name', key: 'course_name' },
    { title: '直播日期', dataIndex: 'session_date', key: 'session_date', width: 120 },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 100 },
    { title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: 100 },
    { 
      title: '回放有效期', 
      dataIndex: 'replay_expiry_date', 
      key: 'replay_expiry_date', 
      width: 120,
      render: (date) => date || '永久'
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      width: 100,
      render: (status) => (
        <Tag color={status === 'completed' ? 'green' : status === 'live' ? 'red' : 'blue'}>
          {status === 'completed' ? '已结束' : status === 'live' ? '直播中' : '待直播'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>直播场次</Title>
        <Text type="secondary">管理所有直播场次和回放配置</Text>
      </div>

      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建场次
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={sessions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title={editingSession ? '编辑直播场次' : '新建直播场次'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="class_id" label="所属班级" rules={[{ required: true }]}>
            <Select placeholder="请选择班级">
              {classes.map(c => (
                <Option key={c.id} value={c.id}>{c.name} - {c.course_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="场次标题" rules={[{ required: true }]}>
            <Input placeholder="例如：第1课 - Python基础" />
          </Form.Item>
          <Form.Item name="session_date" label="直播日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="直播时间">
            <Space style={{ width: '100%' }}>
              <Form.Item name="start_time" noStyle rules={[{ required: true }]}>
                <TimePicker style={{ width: '50%' }} placeholder="开始时间" format="HH:mm" />
              </Form.Item>
              <Form.Item name="end_time" noStyle rules={[{ required: true }]}>
                <TimePicker style={{ width: '50%' }} placeholder="结束时间" format="HH:mm" />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="replay_url" label="回放链接">
            <Input placeholder="请输入回放视频链接" />
          </Form.Item>
          <Form.Item name="replay_expiry_date" label="回放有效期">
            <DatePicker style={{ width: '100%' }} placeholder="留空表示永久有效" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Sessions;
