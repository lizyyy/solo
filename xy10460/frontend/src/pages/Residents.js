import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, message, Popconfirm, Space, Typography
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;

const Residents = () => {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingResident, setEditingResident] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchResidents();
  }, []);

  const fetchResidents = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/residents');
      setResidents(res.data);
    } catch (error) {
      message.error('获取居民列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingResident(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingResident(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/residents/${id}`);
      message.success('删除成功');
      fetchResidents();
    } catch (error) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingResident) {
        await axios.put(`/api/residents/${editingResident.id}`, values);
        message.success('更新成功');
      } else {
        await axios.post('/api/residents', values);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchResidents();
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '手机号', dataIndex: 'phone', key: 'phone' },
    { title: '住址', dataIndex: 'address', key: 'address' },
    { title: '当前积分', dataIndex: 'total_points', key: 'total_points', sorter: (a, b) => a.total_points - b.total_points },
    { 
      title: '创建时间', 
      dataIndex: 'created_at', 
      key: 'created_at',
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at)
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个居民吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="是"
            cancelText="否"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>居民管理</Title>
      
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加居民
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={residents}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingResident ? '编辑居民' : '添加居民'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
            ]}
          >
            <Input placeholder="请输入手机号" />
          </Form.Item>

          <Form.Item
            name="address"
            label="住址"
          >
            <Input.TextArea placeholder="请输入住址" rows={3} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Residents;
