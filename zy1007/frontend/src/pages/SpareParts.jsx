import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Space, Modal, Form, Input, 
  InputNumber, message, Popconfirm, Tag, Spin 
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { sparePartApi } from '../api';

const SpareParts = () => {
  const [loading, setLoading] = useState(true);
  const [spareParts, setSpareParts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadSpareParts();
  }, []);

  const loadSpareParts = async () => {
    try {
      setLoading(true);
      const response = await sparePartApi.getAll();
      setSpareParts(response.data.data || []);
    } catch (error) {
      console.error('加载备件列表失败:', error);
      message.error('加载备件列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingPart(null);
    form.resetFields();
    form.setFieldsValue({
      stock: 0,
      safe_stock: 5,
      unit: '个',
      price: 0
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingPart(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await sparePartApi.delete(id);
      message.success('删除成功');
      loadSpareParts();
    } catch (error) {
      console.error('删除备件失败:', error);
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      if (editingPart) {
        await sparePartApi.update(editingPart.id, values);
        message.success('更新成功');
      } else {
        await sparePartApi.create(values);
        message.success('创建成功');
      }

      setModalVisible(false);
      loadSpareParts();
    } catch (error) {
      console.error('保存备件失败:', error);
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '备件名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span style={{ fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model'
    },
    {
      title: '当前库存',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock, record) => {
        const isLow = stock <= record.safe_stock;
        return (
          <span style={{ 
            color: isLow ? '#ff4d4f' : '#000',
            fontWeight: isLow ? 'bold' : 'normal'
          }}>
            {stock} {record.unit}
            {isLow && <Tag color="red" style={{ marginLeft: 8 }}>库存低</Tag>}
          </span>
        );
      }
    },
    {
      title: '安全库存',
      dataIndex: 'safe_stock',
      key: 'safe_stock',
      render: (safe, record) => `${safe} ${record.unit}`
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      render: (price) => price ? `¥${price}` : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个备件吗？"
            description="删除后无法恢复，请确保该备件未被使用"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>备件管理</h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          添加备件
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={spareParts}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个备件`,
            defaultPageSize: 10
          }}
        />
      </Card>

      <Modal
        title={editingPart ? '编辑备件' : '添加备件'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="备件名称"
            rules={[{ required: true, message: '请输入备件名称' }]}
          >
            <Input placeholder="如：屏幕总成、电池、充电接口等" />
          </Form.Item>

          <Form.Item
            name="model"
            label="型号"
          >
            <Input placeholder="如：iPhone 14、Type-C、通用型等" />
          </Form.Item>

          <Form.Item
            name="unit"
            label="单位"
            rules={[{ required: true, message: '请输入单位' }]}
          >
            <Select
              placeholder="请选择或输入单位"
              options={[
                { value: '个', label: '个' },
                { value: '块', label: '块' },
                { value: '套', label: '套' },
                { value: '件', label: '件' }
              ]}
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="stock"
            label="当前库存"
            rules={[{ required: true, message: '请输入当前库存' }]}
          >
            <InputNumber
              placeholder="请输入当前库存数量"
              min={0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="safe_stock"
            label="安全库存"
            rules={[{ required: true, message: '请输入安全库存' }]}
            extra="当库存低于此值时，会在看板上显示警告"
          >
            <InputNumber
              placeholder="请输入安全库存数量"
              min={0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="price"
            label="单价（元）"
          >
            <InputNumber
              placeholder="请输入单价"
              min={0}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SpareParts;
