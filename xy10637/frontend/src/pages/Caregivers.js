import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag } from 'antd';
import axios from 'axios';

const Caregivers = () => {
  const [data, setData] = useState([]);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get('/api/caregivers');
      setData(res.data.map(item => ({
        ...item,
        qualifications: JSON.parse(item.qualifications || '[]')
      })));
    } catch (err) {
      message.error('加载失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editing) {
        await axios.put(`/api/caregivers/${editing.id}`, {
          ...values,
          qualifications: JSON.stringify(values.qualifications || [])
        });
        message.success('更新成功');
      } else {
        await axios.post('/api/caregivers', {
          ...values,
          qualifications: JSON.stringify(values.qualifications || [])
        });
        message.success('创建成功');
      }
      setVisible(false);
      loadData();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '电话', dataIndex: 'phone', key: 'phone' },
    { title: '资质', dataIndex: 'qualifications', key: 'qualifications', render: qs => (
      <>
        {qs.map(q => <Tag key={q}>{q}</Tag>)}
      </>
    )},
    { title: '技能等级', dataIndex: 'skill_level', key: 'skill_level' },
    { title: '状态', dataIndex: 'status', key: 'status', render: s => (
      <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '在职' : '离职'}</Tag>
    )},
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
        新建陪护人员
      </Button>
      <Table columns={columns} dataSource={data} rowKey="id" style={{ marginTop: 16 }} />
      <Modal
        title={editing ? '编辑陪护人员' : '新建陪护人员'}
        open={visible}
        onCancel={() => setVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="id_card" label="身份证号">
            <Input />
          </Form.Item>
          <Form.Item name="qualifications" label="资质">
            <Select mode="multiple">
              <Select.Option value="基础护理">基础护理</Select.Option>
              <Select.Option value="重症护理">重症护理</Select.Option>
              <Select.Option value="康复护理">康复护理</Select.Option>
              <Select.Option value="儿科护理">儿科护理</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="skill_level" label="技能等级">
            <Select>
              <Select.Option value={1}>初级</Select.Option>
              <Select.Option value={2}>中级</Select.Option>
              <Select.Option value={3}>高级</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select>
              <Select.Option value="active">在职</Select.Option>
              <Select.Option value="inactive">离职</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Caregivers;
