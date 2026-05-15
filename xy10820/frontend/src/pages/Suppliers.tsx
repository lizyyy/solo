import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { suppliersAPI } from '../api';

interface Supplier {
  id: number;
  supplier_code: string;
  supplier_name: string;
  contact_info: any;
  is_active: boolean;
  created_at: string;
}

const Suppliers: React.FC = () => {
  const [data, setData] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await suppliersAPI.list();
      setData(response.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Supplier) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    message.success('删除成功');
    fetchData();
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingItem) {
        await suppliersAPI.update(editingItem.id, values);
        message.success('更新成功');
      } else {
        await suppliersAPI.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '供应商编码', dataIndex: 'supplier_code', key: 'supplier_code' },
    { title: '供应商名称', dataIndex: 'supplier_name', key: 'supplier_name' },
    { title: '状态', dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => v ? '启用' : '禁用' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Supplier) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加供应商</Button>
      </div>
      <Table columns={columns} dataSource={data} loading={loading} rowKey="id" />
      <Modal
        title={editingItem ? '编辑供应商' : '添加供应商'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="supplier_code" label="供应商编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="supplier_name" label="供应商名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">提交</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Suppliers;
