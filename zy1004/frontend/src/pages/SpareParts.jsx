import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Input as AntInput,
} from 'antd';
import { PlusOutlined, InboxOutlined, EditOutlined, WarningOutlined } from '@ant-design/icons';
import { sparePartAPI } from '../services/api';

const { TextArea } = AntInput;

function SpareParts() {
  const [spareParts, setSpareParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [stockInModalVisible, setStockInModalVisible] = useState(false);
  const [currentPart, setCurrentPart] = useState(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [stockInForm] = Form.useForm();

  useEffect(() => {
    loadSpareParts();
  }, []);

  const loadSpareParts = async () => {
    try {
      setLoading(true);
      const res = await sparePartAPI.getAll();
      setSpareParts(res.data);
    } catch (error) {
      message.error('加载备件列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values) => {
    try {
      await sparePartAPI.create(values);
      message.success('创建备件成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadSpareParts();
    } catch (error) {
      message.error(error.message || '创建失败');
    }
  };

  const handleEdit = async (values) => {
    try {
      await sparePartAPI.update(currentPart.id, values);
      message.success('更新备件成功');
      setEditModalVisible(false);
      setCurrentPart(null);
      loadSpareParts();
    } catch (error) {
      message.error(error.message || '更新失败');
    }
  };

  const handleStockIn = async (values) => {
    try {
      await sparePartAPI.stockIn(currentPart.id, {
        quantity: values.quantity,
        notes: values.notes,
      });
      message.success('入库成功');
      setStockInModalVisible(false);
      setCurrentPart(null);
      stockInForm.resetFields();
      loadSpareParts();
    } catch (error) {
      message.error(error.message || '入库失败');
    }
  };

  const openEditModal = (record) => {
    setCurrentPart(record);
    editForm.setFieldsValue({
      name: record.name,
      sku: record.sku,
      category: record.category,
      stock_quantity: record.stock_quantity,
      min_stock: record.min_stock,
      unit_price: record.unit_price,
      unit: record.unit,
      description: record.description,
    });
    setEditModalVisible(true);
  };

  const openStockInModal = (record) => {
    setCurrentPart(record);
    setStockInModalVisible(true);
  };

  const columns = [
    {
      title: '备件名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        const isLowStock = record.stock_quantity <= record.min_stock;
        return (
          <Space>
            {text}
            {isLowStock && (
              <Tag color="red" icon={<WarningOutlined />}>
                低库存
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      render: (v) => v || '-',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (v) => v || '未分类',
    },
    {
      title: '当前库存',
      dataIndex: 'stock_quantity',
      key: 'stock_quantity',
      width: 100,
      render: (qty, record) => {
        const isLowStock = qty <= record.min_stock;
        return (
          <span style={{ color: isLowStock ? '#ff4d4f' : undefined, fontWeight: isLowStock ? 'bold' : undefined }}>
            {qty} {record.unit}
          </span>
        );
      },
    },
    {
      title: '最低库存',
      dataIndex: 'min_stock',
      key: 'min_stock',
      width: 100,
      render: (v, record) => `${v} ${record.unit}`,
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 100,
      render: (v) => `¥${v?.toFixed(2) || '0.00'}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<InboxOutlined />} onClick={() => openStockInModal(record)}>
            入库
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  const categories = ['电饭煲', '空气炸锅', '咖啡机', '冰箱', '洗衣机', '微波炉', '烤箱', '洗碗机', '通用', '其他'];
  const units = ['个', '件', '套', '条', '米', '千克', '其他'];

  return (
    <div>
      <Card
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新建备件
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={spareParts}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `共 ${total} 个备件`,
          }}
        />
      </Card>

      <Modal
        title="新建备件"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="name"
            label="备件名称"
            rules={[{ required: true, message: '请输入备件名称' }]}
          >
            <Input placeholder="请输入备件名称" />
          </Form.Item>
          <Form.Item name="sku" label="SKU">
            <Input placeholder="请输入SKU（可选）" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select placeholder="请选择分类" allowClear>
              {categories.map((c) => (
                <Select.Option key={c} value={c}>
                  {c}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="stock_quantity"
            label="初始库存"
            initialValue={0}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入初始库存" />
          </Form.Item>
          <Form.Item
            name="min_stock"
            label="最低库存预警"
            initialValue={5}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入最低库存预警值" />
          </Form.Item>
          <Form.Item
            name="unit_price"
            label="单价 (元)"
            initialValue={0}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入单价" />
          </Form.Item>
          <Form.Item
            name="unit"
            label="单位"
            initialValue="个"
          >
            <Select placeholder="请选择单位">
              {units.map((u) => (
                <Select.Option key={u} value={u}>
                  {u}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="请输入描述（可选）" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑备件"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="name"
            label="备件名称"
            rules={[{ required: true, message: '请输入备件名称' }]}
          >
            <Input placeholder="请输入备件名称" />
          </Form.Item>
          <Form.Item name="sku" label="SKU">
            <Input placeholder="请输入SKU（可选）" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select placeholder="请选择分类" allowClear>
              {categories.map((c) => (
                <Select.Option key={c} value={c}>
                  {c}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="stock_quantity"
            label="当前库存"
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入库存" />
          </Form.Item>
          <Form.Item
            name="min_stock"
            label="最低库存预警"
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入最低库存预警值" />
          </Form.Item>
          <Form.Item
            name="unit_price"
            label="单价 (元)"
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入单价" />
          </Form.Item>
          <Form.Item
            name="unit"
            label="单位"
          >
            <Select placeholder="请选择单位">
              {units.map((u) => (
                <Select.Option key={u} value={u}>
                  {u}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="请输入描述（可选）" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setEditModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="备件入库"
        open={stockInModalVisible}
        onCancel={() => setStockInModalVisible(false)}
        footer={null}
      >
        {currentPart && (
          <div>
            <p style={{ marginBottom: 16, color: '#666' }}>
              当前备件: <strong>{currentPart.name}</strong>
              <br />
              当前库存: <strong>{currentPart.stock_quantity} {currentPart.unit}</strong>
            </p>
            <Form form={stockInForm} layout="vertical" onFinish={handleStockIn}>
              <Form.Item
                name="quantity"
                label="入库数量"
                rules={[{ required: true, message: '请输入入库数量' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} placeholder={`请输入入库数量（单位: ${currentPart.unit}）`} />
              </Form.Item>
              <Form.Item name="notes" label="备注">
                <TextArea rows={2} placeholder="入库备注（可选）" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    确认入库
                  </Button>
                  <Button onClick={() => setStockInModalVisible(false)}>取消</Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default SpareParts;
