import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message } from 'antd';
import axios from 'axios';

const Wards = () => {
  const [data, setData] = useState([]);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get('/api/wards');
      setData(res.data);
    } catch (err) {
      message.error('加载失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editing) {
        await axios.put(`/api/wards/${editing.id}`, values);
        message.success('更新成功');
      } else {
        await axios.post('/api/wards', values);
        message.success('创建成功');
      }
      setVisible(false);
      loadData();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '病区名称', dataIndex: 'name', key: 'name' },
    { title: '所属科室', dataIndex: 'department', key: 'department' },
    { title: '等级', dataIndex: 'level', key: 'level' },
    {
      title: '操作',
      render: (_, record) => (
        <Button onClick={() => { setEditing(record); form.setFieldsValue(record); setVisible(true); }}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setVisible(true); }}>
        新建病区
      </Button>
      <Table columns={columns} dataSource={data} rowKey="id" style={{ marginTop: 16 }} />
      <Modal
        title={editing ? '编辑病区' : '新建病区'}
        open={visible}
        onCancel={() => setVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="name" label="病区名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="department" label="所属科室">
            <Input />
          </Form.Item>
          <Form.Item name="level" label="等级">
            <Select>
              <Select.Option value={1}>一级</Select.Option>
              <Select.Option value={2}>二级</Select.Option>
              <Select.Option value={3}>三级</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Wards;
