import React, { useEffect, useState } from 'react'
import {
  Table,
  Input,
  Button,
  Space,
  Modal,
  Form,
  InputNumber,
  Select,
  message,
  Tag,
  Popconfirm,
  Descriptions,
  Card,
  List,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  ExportOutlined,
  ImportOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import { ipc } from '../ipc'
import { authStore } from '../store/authStore'
import type { Product, TaskStatus } from '../../types'

const { Text } = Typography

const statusOptions = [
  { label: '待处理', value: 'PENDING' },
  { label: '进行中', value: 'IN_PROGRESS' },
  { label: '待审批', value: 'PENDING_APPROVAL' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已拒绝', value: 'REJECTED' },
  { label: '已取消', value: 'CANCELLED' },
]

function InventoryPage() {
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<string | undefined>()

  const [createVisible, setCreateVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [historyVisible, setHistoryVisible] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [history, setHistory] = useState<any[]>([])

  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [invForm] = Form.useForm()

  const loadProducts = async () => {
    setLoading(true)
    try {
      const result = await ipc.inventory.listProducts({ keyword, category })
      if (result.success) {
        setProducts(result.data.products)
        setTotal(result.data.total)
      }

      const catResult = await ipc.inventory.getCategories()
      if (catResult.success) {
        setCategories(catResult.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handleSearch = () => {
    loadProducts()
  }

  const handleCreate = async (values: any) => {
    try {
      const result = await ipc.inventory.createProduct({
        ...values,
        userId: authStore.currentUser?.id!,
      })
      if (result.success) {
        message.success('创建成功')
        setCreateVisible(false)
        createForm.resetFields()
        loadProducts()
      } else {
        message.error(result.error)
      }
    } catch (err) {
      message.error('创建失败')
    }
  }

  const handleEdit = async (values: any) => {
    if (!currentProduct) return
    try {
      const result = await ipc.inventory.updateProduct(currentProduct.id, {
        ...values,
        userId: authStore.currentUser?.id!,
      })
      if (result.success) {
        message.success('更新成功')
        setEditVisible(false)
        loadProducts()
      } else {
        message.error(result.error)
      }
    } catch (err) {
      message.error('更新失败')
    }
  }

  const handleUpdateInventory = async (values: any) => {
    if (!currentProduct?.inventory) return
    try {
      const result = await ipc.inventory.updateInventory(currentProduct.id, {
        quantity: values.quantity,
        changeReason: values.changeReason,
        minQuantity: values.minQuantity,
        location: values.location,
        userId: authStore.currentUser?.id!,
      })
      if (result.success) {
        message.success('库存更新成功')
        loadProducts()
      } else {
        message.error(result.error)
      }
    } catch (err) {
      message.error('更新失败')
    }
  }

  const showHistory = async (product: Product) => {
    if (!product.inventory) return
    setCurrentProduct(product)
    const result = await ipc.inventory.getHistory(product.inventory.id)
    if (result.success) {
      setHistory(result.data)
      setHistoryVisible(true)
    }
  }

  const handleExport = async (format: 'excel' | 'csv') => {
    const dialog = await ipc.export.saveDialog()
    if (!dialog.success || !dialog.filePath) return

    const filePath = dialog.filePath.endsWith(format === 'excel' ? '.xlsx' : '.csv')
      ? dialog.filePath
      : dialog.filePath + (format === 'excel' ? '.xlsx' : '.csv')

    const result = format === 'excel'
      ? await ipc.export.inventoryExcel(filePath, { category })
      : await ipc.export.inventoryCSV(filePath, { category })

    if (result.success) {
      message.success(`已导出 ${result.data.count} 条记录到: ${filePath}`)
    } else {
      message.error(result.error)
    }
  }

  const handleImport = async () => {
    const dialog = await ipc.export.openDialog()
    if (!dialog.success || !dialog.filePaths?.length) return

    const result = await ipc.export.importInventory(
      dialog.filePaths[0],
      authStore.currentUser?.id!
    )

    if (result.success) {
      const data = result.data
      message.success(`导入完成: 成功 ${data.imported} 条, 错误 ${data.errors.length} 条`)
      if (data.errors.length > 0) {
        console.log('Import errors:', data.errors)
      }
      loadProducts()
    } else {
      message.error(result.error)
    }
  }

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: '商品名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '分类', dataIndex: 'category', key: 'category', width: 120,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '-' },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
    { title: '库存数量', key: 'quantity', width: 120,
      render: (_: any, r: Product) => (
        <Space>
          <Text strong style={{ color: r.inventory && r.inventory.quantity < r.inventory.minQuantity ? '#ff4d4f' : '#000' }}>
            {r.inventory?.quantity || 0}
          </Text>
          {r.inventory && r.inventory.quantity < r.inventory.minQuantity && (
            <Tag color="red">预警</Tag>
          )}
        </Space>
      )},
    { title: '最小库存', dataIndex: ['inventory', 'minQuantity'], key: 'minQuantity', width: 80 },
    { title: '库位', dataIndex: ['inventory', 'location'], key: 'location', width: 100 },
    { title: '操作', key: 'action', width: 220,
      render: (_: any, r: Product) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setCurrentProduct(r)
            editForm.setFieldsValue({
              name: r.name,
              category: r.category,
              unit: r.unit,
              description: r.description,
            })
            setEditVisible(true)
          }}>编辑</Button>
          <Button size="small" type="dashed" onClick={() => {
            setCurrentProduct(r)
            invForm.setFieldsValue({
              quantity: r.inventory?.quantity || 0,
              minQuantity: r.inventory?.minQuantity || 0,
              location: r.inventory?.location,
              changeReason: '',
            })
          }}>调库存</Button>
          <Button size="small" icon={<HistoryOutlined />} disabled={!r.inventory} onClick={() => showHistory(r)}>历史</Button>
        </Space>
      )},
  ]

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索 SKU 或商品名称"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="选择分类"
            value={category}
            onChange={setCategory}
            allowClear
            style={{ width: 150 }}
          >
            {categories.map(c => (
              <Select.Option key={c} value={c}>{c}</Select.Option>
            ))}
          </Select>
          <Button type="primary" onClick={handleSearch}>搜索</Button>
          <Button icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>新建商品</Button>
          <Button icon={<ExportOutlined />} onClick={() => handleExport('excel')}>导出Excel</Button>
          <Button icon={<ExportOutlined />} onClick={() => handleExport('csv')}>导出CSV</Button>
          <Button icon={<ImportOutlined />} onClick={handleImport}>导入Excel</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={products}
        loading={loading}
        pagination={{ total, pageSize: 20 }}
      />

      <Modal
        title="新建商品"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => createForm.submit()}
        width={500}
      >
        <Form layout="vertical" form={createForm} onFinish={handleCreate}>
          <Form.Item name="sku" label="SKU" rules={[{ required: true }]}>
            <Input placeholder="商品SKU" />
          </Form.Item>
          <Form.Item name="name" label="商品名称" rules={[{ required: true }]}>
            <Input placeholder="商品名称" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select mode="tags" placeholder="输入或选择分类">
              {categories.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="unit" label="单位" initialValue="个">
            <Input placeholder="单位" />
          </Form.Item>
          <Form.Item name="quantity" label="初始库存数量">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="minQuantity" label="最小库存预警" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="库位">
            <Input placeholder="库位编号" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑商品"
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={() => editForm.submit()}
        width={500}
      >
        <Form layout="vertical" form={editForm} onFinish={handleEdit}>
          <Form.Item name="name" label="商品名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select mode="tags" placeholder="输入或选择分类">
              {categories.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="unit" label="单位">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`调整库存 - ${currentProduct?.name}`}
        open={!!currentProduct && invForm.getFieldValue('quantity') !== undefined}
        onCancel={() => setCurrentProduct(null)}
        onOk={() => invForm.submit()}
        width={400}
      >
        <Form layout="vertical" form={invForm} onFinish={handleUpdateInventory}>
          <Form.Item name="quantity" label="库存数量" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="minQuantity" label="最小库存">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="库位">
            <Input />
          </Form.Item>
          <Form.Item name="changeReason" label="调整原因" rules={[{ required: true }]}>
            <Select placeholder="选择调整原因">
              <Select.Option value="盘点调整">盘点调整</Select.Option>
              <Select.Option value="日常补货">日常补货</Select.Option>
              <Select.Option value="商品出库">商品出库</Select.Option>
              <Select.Option value="商品入库">商品入库</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="库存变更历史"
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        footer={null}
        width={600}
      >
        <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="商品">{currentProduct?.sku} - {currentProduct?.name}</Descriptions.Item>
          <Descriptions.Item label="当前库存">{currentProduct?.inventory?.quantity}</Descriptions.Item>
        </Descriptions>
        <List
          size="small"
          dataSource={history}
          renderItem={(item) => (
            <List.Item>
              <span style={{ width: 160, color: '#999', fontSize: 12 }}>
                {new Date(item.changedAt).toLocaleString()}
              </span>
              <span>
                <Tag color={item.newQuantity > item.oldQuantity ? 'green' : 'red'}>
                  {item.oldQuantity} → {item.newQuantity}
                  ({item.newQuantity > item.oldQuantity ? '+' : ''}{item.newQuantity - item.oldQuantity})
                </Tag>
              </span>
              <Tag color="blue">{item.changeReason}</Tag>
            </List.Item>
          )}
        />
      </Modal>
    </div>
  )
}

export default InventoryPage
