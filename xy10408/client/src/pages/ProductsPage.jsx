import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import { productApi } from '../utils/api'

const categoryOptions = [
  { label: '水果', value: '水果' },
  { label: '预制菜', value: '预制菜' },
  { label: '日用品', value: '日用品' }
]

const ProductsPage = () => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form] = Form.useForm()

  const loadProducts = async () => {
    setLoading(true)
    try {
      const res = await productApi.getAll()
      setProducts(res.data)
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handleCreate = () => {
    setEditingProduct(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    form.setFieldsValue(product)
    setModalVisible(true)
  }

  const handleSubmit = async (values) => {
    try {
      if (editingProduct) {
        await productApi.update(editingProduct.id, values)
        message.success('更新成功')
      } else {
        await productApi.create(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      form.resetFields()
      loadProducts()
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  const getCategoryColor = (category) => {
    switch (category) {
      case '水果': return 'green'
      case '预制菜': return 'orange'
      case '日用品': return 'blue'
      default: return 'default'
    }
  }

  const columns = [
    {
      title: '商品编码',
      dataIndex: 'product_code',
      key: 'product_code',
      width: 100
    },
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat) => <Tag color={getCategoryColor(cat)}>{cat}</Tag>
    },
    {
      title: '规格',
      dataIndex: 'specs',
      key: 'specs',
      width: 150
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price) => `¥${price.toFixed(2)}`
    },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      render: (stock) => stock > 0 ? <span>{stock}</span> : <span style={{ color: 'red' }}>{stock}</span>
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">商品规格管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          添加商品
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={products}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={editingProduct ? '编辑商品' : '添加商品'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="product_code" label="商品编码" rules={[{ required: true, message: '请输入商品编码' }]}>
            <Input placeholder="例如：F001" disabled={!!editingProduct} />
          </Form.Item>
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item name="specs" label="规格" rules={[{ required: true, message: '请输入规格' }]}>
            <Input placeholder="例如：5斤装" />
          </Form.Item>
          <Form.Item name="price" label="单价(元)" rules={[{ required: true, message: '请输入单价' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stock" label="库存" rules={[{ required: true, message: '请输入库存' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ProductsPage
