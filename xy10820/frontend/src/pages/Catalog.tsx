import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { catalogAPI } from '../api';

interface CatalogItem {
  id: number;
  internal_sku: string;
  product_name: string;
  category: string;
  brand: string;
  price: number;
  is_active: boolean;
  created_at: string;
}

const Catalog: React.FC = () => {
  const [data, setData] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await catalogAPI.list();
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
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      await catalogAPI.create(values);
      message.success('创建成功');
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '内部SKU', dataIndex: 'internal_sku', key: 'internal_sku' },
    { title: '商品名称', dataIndex: 'product_name', key: 'product_name' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    { title: '品牌', dataIndex: 'brand', key: 'brand' },
    { title: '价格', dataIndex: 'price', key: 'price' },
    { title: '状态', dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => v ? '启用' : '禁用' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加目录项</Button>
      </div>
      <Table columns={columns} dataSource={data} loading={loading} rowKey="id" />
      <Modal title="添加目录项" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="internal_sku" label="内部SKU" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="product_name" label="商品名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input />
          </Form.Item>
          <Form.Item name="brand" label="品牌">
            <Input />
          </Form.Item>
          <Form.Item name="price" label="价格">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">提交</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Catalog;
