import React, { useState, useEffect } from 'react';
import { Table, Select, Space, Tag, message } from 'antd';
import { productsAPI, suppliersAPI } from '../api';

interface Product {
  id: number;
  supplier_id: number;
  supplier_sku: string;
  product_name: string;
  raw_data: any;
  field_version: number;
  is_dirty: boolean;
  created_at: string;
}

const Products: React.FC = () => {
  const [data, setData] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await suppliersAPI.list();
        setSuppliers(response.data);
        if (response.data.length > 0) {
          setSelectedSupplier(response.data[0].id);
        }
      } catch (error) {
        message.error('获取供应商列表失败');
      }
    };
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      fetchProducts();
    }
  }, [selectedSupplier]);

  const fetchProducts = async () => {
    if (!selectedSupplier) return;
    setLoading(true);
    try {
      const response = await productsAPI.listBySupplier(selectedSupplier);
      setData(response.data);
    } catch (error) {
      message.error('获取商品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '供应商SKU', dataIndex: 'supplier_sku', key: 'supplier_sku' },
    { title: '商品名称', dataIndex: 'product_name', key: 'product_name' },
    { title: '字段版本', dataIndex: 'field_version', key: 'field_version', width: 100 },
    {
      title: '数据状态',
      dataIndex: 'is_dirty',
      key: 'is_dirty',
      width: 100,
      render: (v: boolean) => v ? <Tag color="red">脏数据</Tag> : <Tag color="green">正常</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <span>选择供应商:</span>
          <Select
            style={{ width: 200 }}
            value={selectedSupplier}
            onChange={setSelectedSupplier}
            options={suppliers.map(s => ({ value: s.id, label: s.supplier_name })}
          />
        </Space>
      </div>
      <Table columns={columns} dataSource={data} loading={loading} rowKey="id" />
    </div>
  );
};

export default Products;
