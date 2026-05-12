import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message, Tag } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;

function Persons({ onSelectPerson }) {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [keyword, setKeyword] = useState('');

  const loadPersons = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/persons', { params: { keyword } });
      setPersons(res.data);
    } catch (err) {
      message.error('加载人员列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPersons();
  }, [keyword]);

  const handleAdd = async (values) => {
    try {
      await axios.post('/api/persons', values);
      message.success('添加成功');
      setModalVisible(false);
      form.resetFields();
      loadPersons();
    } catch (err) {
      message.error(err.response?.data?.error || '添加失败');
    }
  };

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '身份证', dataIndex: 'id_card', key: 'id_card' },
    { title: '电话', dataIndex: 'phone', key: 'phone' },
    { title: '性别', dataIndex: 'gender', key: 'gender' },
    { title: '外包公司', dataIndex: 'outsourcing_company', key: 'outsourcing_company' },
    { title: '项目', dataIndex: 'project', key: 'project' },
    {
      title: '培训状态',
      dataIndex: 'training_completed',
      key: 'training_completed',
      render: (val) => val > 0 ? <Tag color="green">已完成</Tag> : <Tag color="red">未完成</Tag>
    },
    {
      title: '工牌状态',
      dataIndex: 'badge_issued',
      key: 'badge_issued',
      render: (val) => val > 0 ? <Tag color="blue">已发放</Tag> : <Tag color="default">未发放</Tag>
    },
    {
      title: '操作',
      render: (_, record) => (
        <Button type="link" onClick={() => onSelectPerson(record)}>查看详情</Button>
      )
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input
            placeholder="搜索姓名/身份证/电话"
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          添加人员
        </Button>
      </Space>

      <Table
        dataSource={persons}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="添加人员"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleAdd} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="id_card" label="身份证号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="gender" label="性别">
            <Select>
              <Option value="男">男</Option>
              <Option value="女">女</Option>
            </Select>
          </Form.Item>
          <Form.Item name="outsourcing_company" label="外包公司">
            <Input />
          </Form.Item>
          <Form.Item name="project" label="所属项目">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
              提交
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Persons;
