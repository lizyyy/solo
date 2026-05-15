import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, Space, message, Timeline, Tag } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { mappingsAPI, productsAPI, catalogAPI, suppliersAPI } from '../api';

interface Mapping {
  id: number;
  supplier_product_id: number;
  internal_product_id: number;
  confidence_score: number;
  is_manual: boolean;
  created_at: string;
}

const Mappings: React.FC = () => {
  const [data, setData] = useState<Mapping[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<number | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mappingsRes, suppliersRes, catalogRes] = await Promise.all([
        mappingsAPI.list(),
        suppliersAPI.list(),
        catalogAPI.list(),
      ]);
      setData(mappingsRes.data);
      setSuppliers(suppliersRes.data);
      setCatalog(catalogRes.data);
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSupplierChange = async (supplierId: number) => {
    try {
      const response = await productsAPI.listBySupplier(supplierId);
      setProducts(response.data);
    } catch (error) {
      message.error('获取商品列表失败');
    }
  };

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleViewTimeline = async (id: number) => {
    try {
      const response = await mappingsAPI.getTimeline(id);
      setTimelineData(response.data);
      setSelectedMapping(id);
      setTimelineVisible(true);
    } catch (error) {
      message.error('获取时间线失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      await mappingsAPI.create({ ...values, is_manual: true });
      message.success('创建成功');
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '供应商商品ID', dataIndex: 'supplier_product_id', key: 'supplier_product_id' },
    { title: '内部目录ID', dataIndex: 'internal_product_id', key: 'internal_product_id' },
    { title: '置信度', dataIndex: 'confidence_score', key: 'confidence_score' },
    {
      title: '映射类型',
      dataIndex: 'is_manual',
      key: 'is_manual',
      render: (v: boolean) => v ? <Tag color="blue">手动</Tag> : <Tag color="green">自动</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Mapping) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleViewTimeline(record.id)}>时间线</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>创建映射</Button>
      </div>
      <Table columns={columns} dataSource={data} loading={loading} rowKey="id" />
      <Modal title="创建映射" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="supplier_id" label="选择供应商" rules={[{ required: true }]}>
            <Select onChange={handleSupplierChange}>
              {suppliers.map(s => (
                <Select.Option key={s.id} value={s.id}>{s.supplier_name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="supplier_product_id" label="供应商商品" rules={[{ required: true }]}>
            <Select>
              {products.map(p => (
                <Select.Option key={p.id} value={p.id}>{p.supplier_sku} - {p.product_name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="internal_product_id" label="内部目录项" rules={[{ required: true }]}>
            <Select>
              {catalog.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.internal_sku} - {c.product_name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">提交</Button>
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="映射时间线" open={timelineVisible} onCancel={() => setTimelineVisible(false)} footer={null} width={600}>
        <Timeline
          items={timelineData.map((item: any) => ({
            children: (
              <div>
                <p><strong>{item.action}</strong></p>
                <p style={{ fontSize: 12, color: '#666' }}>{item.created_at}</p>
                {item.performed_by && <p style={{ fontSize: 12 }}>操作人: {item.performed_by}</p>}
              </div>
            ),
          }))}
        />
      </Modal>
    </div>
  );
};

export default Mappings;
