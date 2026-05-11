import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Select,
  InputNumber,
  Input,
  Button,
  Space,
  message,
  Table,
  Tag,
  Descriptions,
  Row,
  Col,
  Statistic,
  Divider,
  Spin
} from 'antd';
import {
  SwapOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  WarningOutlined
} from '@ant-design/icons';
import inventoryService from '../services/inventoryService';
import operationService from '../services/operationService';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

function Transfer() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [transferLoading, setTransferLoading] = useState(false);

  const mockStores = [
    { id: 'store-1', name: '总店', code: 'ST001' },
    { id: 'store-2', name: '分店A', code: 'ST002' },
    { id: 'store-3', name: '分店B', code: 'ST003' }
  ];

  const mockProducts = [
    { id: 'prod-1', name: '商品A', sku: 'SKU001', basePrice: 99.99 },
    { id: 'prod-2', name: '商品B', sku: 'SKU002', basePrice: 199.99 },
    { id: 'prod-3', name: '商品C', sku: 'SKU003', basePrice: 299.99 },
    { id: 'prod-4', name: '商品D', sku: 'SKU004', basePrice: 399.99 },
    { id: 'prod-5', name: '商品E', sku: 'SKU005', basePrice: 499.99 }
  ];

  const [fromStore, setFromStore] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [inventoryData, setInventoryData] = useState([]);

  const loadInventory = async (storeId = null) => {
    setLoading(true);
    try {
      const result = await inventoryService.getInventory({
        storeId,
        limit: 100
      });
      if (result.success) {
        setInventoryData(result.data.rows);
      }
    } catch (error) {
      message.error('加载库存数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTransfers = async () => {
    setTransferLoading(true);
    try {
      const result = await operationService.getTransfers({ limit: 50 });
      if (result.success) {
        setTransfers(result.data.rows);
      }
    } catch (error) {
      console.warn('加载调拨单失败:', error.message);
    } finally {
      setTransferLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
    loadTransfers();
  }, []);

  const getProductInventoryInStore = (storeId, productId) => {
    return inventoryData.find(item => item.storeId === storeId && item.productId === productId);
  };

  const handleFromStoreChange = (value) => {
    setFromStore(value);
    setSelectedProduct(null);
    form.setFieldsValue({ productId: null, quantity: undefined });
  };

  const handleProductChange = (productId) => {
    setSelectedProduct(productId);
    const inv = getProductInventoryInStore(fromStore, productId);
    if (inv) {
      form.setFieldsValue({ quantity: undefined });
    }
  };

  const handleSubmit = async (values) => {
    setTransferring(true);
    try {
      const inv = getProductInventoryInStore(values.fromStoreId, values.productId);
      if (!inv) {
        message.error('调出门店不存在该商品库存');
        return;
      }

      if (inv.quantity < values.quantity) {
        message.error(`库存不足，当前库存: ${inv.quantity}`);
        return;
      }

      const result = await inventoryService.transferStock({
        fromStoreId: values.fromStoreId,
        toStoreId: values.toStoreId,
        productId: values.productId,
        quantity: values.quantity,
        remarks: values.remarks
      });

      if (result.success) {
        if (result.isDuplicate) {
          message.info('重复请求已忽略，调拨已完成');
        } else {
          message.success('调拨成功！');
        }
        form.resetFields();
        setFromStore(null);
        setSelectedProduct(null);
        loadInventory();
        loadTransfers();
      } else {
        message.error(result.message || '调拨失败');
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message || '调拨失败';
      if (msg.includes('锁定')) {
        message.error(msg + '，请稍后重试');
      } else if (msg.includes('已被其他操作修改')) {
        message.error(msg + '，请刷新后重试');
      } else {
        message.error(msg);
      }
    } finally {
      setTransferring(false);
    }
  };

  const statusMap = {
    PENDING: { color: 'orange', label: '待处理', icon: <LoadingOutlined /> },
    APPROVED: { color: 'blue', label: '已审批' },
    SHIPPED: { color: 'cyan', label: '已出库' },
    RECEIVED: { color: 'green', label: '已完成', icon: <CheckCircleOutlined /> },
    CANCELLED: { color: 'default', label: '已取消' },
    FAILED: { color: 'red', label: '失败', icon: <WarningOutlined /> }
  };

  const transferColumns = [
    {
      title: '调拨单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 180,
      render: (val) => <Tag color="blue">{val}</Tag>
    },
    {
      title: '调出门店',
      key: 'fromStore',
      render: (_, record) => {
        const store = mockStores.find(s => s.id === record.fromStoreId);
        return store?.name || record.fromStoreId;
      }
    },
    {
      title: '调入门店',
      key: 'toStore',
      render: (_, record) => {
        const store = mockStores.find(s => s.id === record.toStoreId);
        return store?.name || record.toStoreId;
      }
    },
    {
      title: '商品',
      key: 'product',
      render: (_, record) => {
        const product = mockProducts.find(p => p.id === record.productId);
        return product?.name || record.productId;
      }
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const info = statusMap[status] || { color: 'default', label: status };
        return (
          <Tag color={info.color}>
            {info.icon} {info.label}
          </Tag>
        );
      }
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  const currentInv = fromStore && selectedProduct 
    ? getProductInventoryInStore(fromStore, selectedProduct)
    : null;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>
          <Space>
            <SwapOutlined />
            <span>库存调拨</span>
          </Space>
        </h2>
        <Button icon={<ReloadOutlined />} onClick={() => { loadInventory(); loadTransfers(); }}>
          刷新
        </Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="新建调拨单" extra={<Tag color="blue">分布式锁 + 版本校验</Tag>}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              size="large"
            >
              <Form.Item
                name="fromStoreId"
                label="调出门店"
                rules={[{ required: true, message: '请选择调出门店' }]}
              >
                <Select
                  placeholder="请选择调出门店"
                  onChange={handleFromStoreChange}
                  allowClear
                >
                  {mockStores.map(store => (
                    <Option key={store.id} value={store.id}>
                      {store.name} ({store.code})
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="toStoreId"
                label="调入门店"
                rules={[
                  { required: true, message: '请选择调入门店' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('fromStoreId') !== value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('调入门店不能与调出门店相同'));
                    }
                  })
                ]}
              >
                <Select
                  placeholder="请选择调入门店"
                  allowClear
                >
                  {mockStores.filter(s => s.id !== fromStore).map(store => (
                    <Option key={store.id} value={store.id}>
                      {store.name} ({store.code})
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="productId"
                label="商品"
                rules={[{ required: true, message: '请选择商品' }]}
              >
                <Select
                  placeholder="请选择要调拨的商品"
                  disabled={!fromStore}
                  onChange={handleProductChange}
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {mockProducts.map(product => {
                    const inv = getProductInventoryInStore(fromStore, product.id);
                    return (
                      <Option 
                        key={product.id} 
                        value={product.id}
                        disabled={!inv}
                      >
                        {product.name} ({product.sku})
                        {inv ? ` - 库存: ${inv.quantity}` : ' - 无库存'}
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>

              {currentInv && (
                <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="当前库存">
                      <Tag color={currentInv.quantity > 0 ? 'green' : 'red'}>
                        {currentInv.quantity}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="当前版本">
                      v{currentInv.version}
                    </Descriptions.Item>
                    <Descriptions.Item label="单价" span={2}>
                      ¥{Number(currentInv.price).toFixed(2)}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              <Form.Item
                name="quantity"
                label="调拨数量"
                rules={[
                  { required: true, message: '请输入调拨数量' },
                  { type: 'number', min: 1, message: '调拨数量必须大于0' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || !currentInv || value <= currentInv.quantity) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(`库存不足，当前库存: ${currentInv.quantity}`));
                    }
                  })
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入调拨数量"
                  min={1}
                  max={currentInv?.quantity}
                  disabled={!currentInv}
                  addonBefore="件"
                />
              </Form.Item>

              <Form.Item
                name="remarks"
                label="备注（可选）"
              >
                <TextArea rows={3} placeholder="请输入调拨备注" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={transferring}
                  size="large"
                  block
                  icon={<SwapOutlined />}
                >
                  {transferring ? '处理中（分布式锁已获取）...' : '确认调拨'}
                </Button>
              </Form.Item>
            </Form>

            <Divider />

            <Card size="small" title="调拨机制说明" type="inner" style={{ background: '#fffbe6' }}>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#666' }}>
                <li><b>分布式锁</b>：调出门店和调入门店同时获取锁</li>
                <li><b>版本校验</b>：操作前验证版本号，防止并发修改</li>
                <li><b>事务保证</b>：所有操作在同一数据库事务中执行</li>
                <li><b>幂等性</b>：重复请求使用相同X-Request-ID会被拦截</li>
                <li><b>操作追踪</b>：产生TRANSFER_OUT和TRANSFER_IN两条日志</li>
              </ul>
            </Card>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="调拨历史记录">
            <Table
              columns={transferColumns}
              dataSource={transfers}
              rowKey="id"
              loading={transferLoading}
              pagination={{ pageSize: 10 }}
              size="small"
              scroll={{ x: 900 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Transfer;
