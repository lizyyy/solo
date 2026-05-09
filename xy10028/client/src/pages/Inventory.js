import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  message,
  Tag,
  Popconfirm,
  Card,
  Descriptions,
  Divider,
  Tabs,
  List
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  ExportOutlined,
  HistoryOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import inventoryService from '../services/inventoryService';
import operationService from '../services/operationService';
import dayjs from 'dayjs';

const { Option } = Select;
const { TabPane } = Tabs;

function Inventory() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({});
  
  const [modalType, setModalType] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [form] = Form.useForm();
  
  const [operationLogs, setOperationLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);

  const mockStores = [
    { id: 'store-1', name: '总店', code: 'ST001' },
    { id: 'store-2', name: '分店A', code: 'ST002' },
    { id: 'store-3', name: '分店B', code: 'ST003' }
  ];

  const mockProducts = [
    { id: 'prod-1', name: '商品A', sku: 'SKU001', basePrice: 99.99, category: '分类1' },
    { id: 'prod-2', name: '商品B', sku: 'SKU002', basePrice: 199.99, category: '分类1' },
    { id: 'prod-3', name: '商品C', sku: 'SKU003', basePrice: 299.99, category: '分类2' }
  ];

  const loadData = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const result = await inventoryService.getInventory({
        page,
        limit: pageSize,
        ...filters
      });

      if (result.success) {
        setData(result.data.rows.map(row => ({
          ...row,
          store: mockStores.find(s => s.id === row.storeId) || { name: '未知门店' },
          product: mockProducts.find(p => p.id === row.productId) || { name: '未知商品' }
        })));
        setPagination({
          current: page,
          pageSize,
          total: result.data.pagination.total
        });
      }
    } catch (error) {
      message.error('加载库存数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const columns = [
    {
      title: '门店',
      key: 'store',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.store?.name}</span>
          <span style={{ color: '#888', fontSize: '12px' }}>{mockStores.find(s => s.id === record.storeId)?.code}</span>
        </Space>
      )
    },
    {
      title: '商品',
      key: 'product',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.product?.name}</span>
          <span style={{ color: '#888', fontSize: '12px' }}>{record.product?.sku}</span>
        </Space>
      )
    },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      render: (qty, record) => {
        let color = 'green';
        if (qty <= record.minStock) color = 'red';
        else if (qty <= record.minStock * 2) color = 'orange';
        return <Tag color={color}>{qty}</Tag>;
      }
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price) => `¥${Number(price).toFixed(2)}`
    },
    {
      title: '库存总值',
      key: 'totalValue',
      width: 120,
      render: (_, record) => `¥${(Number(record.quantity) * Number(record.price)).toFixed(2)}`
    },
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 80
    },
    {
      title: '最后更新',
      dataIndex: 'lastUpdatedAt',
      key: 'lastUpdatedAt',
      width: 160,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleAdjust(record)}>
            调整库存
          </Button>
          <Button type="link" size="small" onClick={() => handlePriceChange(record)}>
            改价
          </Button>
          <Button type="link" size="small" onClick={() => handleViewDetails(record)}>
            详情
          </Button>
        </Space>
      )
    }
  ];

  const handleAdjust = (record) => {
    setSelectedItem(record);
    setModalType('adjust');
    form.resetFields();
    setModalVisible(true);
  };

  const handlePriceChange = (record) => {
    setSelectedItem(record);
    setModalType('price');
    form.setFieldsValue({ price: Number(record.price) });
    setModalVisible(true);
  };

  const handleViewDetails = async (record) => {
    setSelectedItem(record);
    setDetailVisible(true);
    loadOperationLogs(record.id);
  };

  const loadOperationLogs = async (inventoryId) => {
    setLogsLoading(true);
    try {
      const result = await operationService.getInventoryOperations(inventoryId, { limit: 20 });
      if (result.success) {
        setOperationLogs(result.data.rows);
      }
    } catch (error) {
      message.error('加载操作日志失败');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    if (modalType === 'adjust') {
      const result = await inventoryService.adjustInventory(
        selectedItem.id,
        {
          quantity: values.quantity,
          reason: values.reason
        }
      );
      if (result.success) {
        message.success(result.isDuplicate ? '重复请求已忽略，返回上次结果' : '库存调整成功');
        setModalVisible(false);
        loadData(pagination.current, pagination.pageSize);
      } else {
        message.error(result.message || '操作失败');
      }
    } else if (modalType === 'price') {
      const result = await inventoryService.updatePrice(
        selectedItem.id,
        values.price,
        values.reason
      );
      if (result.success) {
        if (result.noChange) {
          message.info('价格未变化');
        } else {
          message.success(result.isDuplicate ? '重复请求已忽略，返回上次结果' : '价格更新成功');
        }
        setModalVisible(false);
        loadData(pagination.current, pagination.pageSize);
      } else {
        message.error(result.message || '操作失败');
      }
    }
  };

  const handleTableChange = (pagination) => {
    loadData(pagination.current, pagination.pageSize);
  };

  const operationTypeMap = {
    CREATE: { color: 'green', label: '创建' },
    UPDATE: { color: 'blue', label: '更新' },
    ADJUST: { color: 'orange', label: '调整' },
    TRANSFER_IN: { color: 'cyan', label: '调入' },
    TRANSFER_OUT: { color: 'purple', label: '调出' },
    PRICE_CHANGE: { color: 'magenta', label: '改价' }
  };

  return (
    <div>
      <Card
        title="库存管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => loadData(pagination.current, pagination.pageSize)} loading={loading}>
              刷新
            </Button>
            <Select
              placeholder="筛选门店"
              style={{ width: 150 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, storeId: value })}
            >
              {mockStores.map(store => (
                <Option key={store.id} value={store.id}>{store.name}</Option>
              ))}
            </Select>
            <Button type="primary" icon={<PlusOutlined />}>
              新增库存
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showTotal: (total) => `共 ${total} 条记录`,
            showSizeChanger: true
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={modalType === 'adjust' ? '调整库存' : '修改价格'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="商品">
              {selectedItem?.product?.name}
            </Descriptions.Item>
            <Descriptions.Item label="当前库存">
              {selectedItem?.quantity}
            </Descriptions.Item>
            <Descriptions.Item label="当前价格">
              ¥{Number(selectedItem?.price || 0).toFixed(2)}
            </Descriptions.Item>
          </Descriptions>

          {modalType === 'adjust' ? (
            <Form.Item
              name="quantity"
              label="调整数量"
              rules={[{ required: true, message: '请输入调整数量' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="正数增加，负数减少"
                addonBefore={<span style={{ color: '#888' }}>±</span>}
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="price"
              label="新价格"
              rules={[
                { required: true, message: '请输入新价格' },
                { type: 'number', min: 0, message: '价格不能为负数' }
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="请输入新价格"
                precision={2}
                min={0}
                prefix="¥"
              />
            </Form.Item>
          )}

          <Form.Item
            name="reason"
            label="变更原因"
            rules={[{ required: true, message: '请输入变更原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入变更原因" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="库存详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        <Tabs defaultActiveKey="1">
          <TabPane tab="基本信息" key="1">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="商品名称">{selectedItem?.product?.name}</Descriptions.Item>
              <Descriptions.Item label="SKU">{selectedItem?.product?.sku}</Descriptions.Item>
              <Descriptions.Item label="门店">{selectedItem?.store?.name}</Descriptions.Item>
              <Descriptions.Item label="库存数量">{selectedItem?.quantity}</Descriptions.Item>
              <Descriptions.Item label="单价">¥{Number(selectedItem?.price || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="库存总值">¥{(Number(selectedItem?.quantity || 0) * Number(selectedItem?.price || 0)).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="最低库存">{selectedItem?.minStock}</Descriptions.Item>
              <Descriptions.Item label="版本号">{selectedItem?.version}</Descriptions.Item>
              <Descriptions.Item label="最后更新" span={2}>
                {selectedItem?.lastUpdatedAt ? dayjs(selectedItem.lastUpdatedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>
          </TabPane>
          <TabPane tab="操作历史" key="2">
            <List
              loading={logsLoading}
              dataSource={operationLogs}
              renderItem={(log) => {
                const typeInfo = operationTypeMap[log.operationType] || { color: 'default', label: log.operationType };
                return (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Tag color={typeInfo.color}>{typeInfo.label}</Tag>}
                      title={
                        <Space>
                          <span>
                            变更: {log.beforeState?.quantity ?? '-'} → {log.afterState?.quantity ?? '-'}
                          </span>
                          {log.status === 'SUCCESS' ? (
                            <CheckCircleOutlined style={{ color: 'green' }} />
                          ) : (
                            <CloseCircleOutlined style={{ color: 'red' }} />
                          )}
                        </Space>
                      }
                      description={
                        <Space split={<Divider type="vertical" />}>
                          <span>操作人: {log.User?.name || '-'}</span>
                          <span>时间: {dayjs(log.operationAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                          <span>请求ID: {log.requestId?.slice(0, 8)}...</span>
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </TabPane>
        </Tabs>
      </Modal>
    </div>
  );
}

export default Inventory;
