import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Modal,
  Form,
  InputNumber,
  message,
  Popconfirm,
  Tooltip,
  Row,
  Col,
  Drawer,
  Checkbox
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ExportOutlined,
  ImportOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { RangePickerProps } from 'antd/es/date-picker';
import dayjs, { Dayjs } from 'dayjs';
import { User, ReissueStatus, ReissueOrder } from '../../shared/types';
import { STATUS_LABELS, STATUS_COLORS, STATUS_TRANSITIONS } from '../../shared/constants';
import { hasPermission } from '../hooks/useAuth';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;

interface OrderListPageProps {
  currentUser: Omit<User, 'password'>;
  onViewDetail: (orderId: string) => void;
}

const OrderListPage: React.FC<OrderListPageProps> = ({ currentUser, onViewDetail }) => {
  const [orders, setOrders] = useState<ReissueOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ReissueOrder | null>(null);
  const [form] = Form.useForm();
  const [users, setUsers] = useState<Array<Omit<User, 'password'>>>([]);

  const [filters, setFilters] = useState({
    status: undefined as ReissueStatus | undefined,
    orderNo: '',
    customerName: '',
    customerPhone: '',
    dateRange: null as [Dayjs, Dayjs] | null
  });

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        pageSize
      };

      if (filters.status) params.status = filters.status;
      if (filters.orderNo) params.orderNo = filters.orderNo;
      if (filters.customerName) params.customerName = filters.customerName;
      if (filters.customerPhone) params.customerPhone = filters.customerPhone;
      if (filters.dateRange) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
      }

      const result = await window.electronAPI.order.list(params);
      if (result.success) {
        setOrders(result.data.data);
        setTotal(result.data.total);
      }
    } catch (error) {
      message.error('加载订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (hasPermission(currentUser, 'user.read')) {
      const result = await window.electronAPI.user.list();
      if (result.success) {
        setUsers(result.data);
      }
    }
  };

  useEffect(() => {
    loadOrders();
    loadUsers();
  }, [page, pageSize, filters]);

  const handleCreate = async (values: any) => {
    try {
      const result = await window.electronAPI.order.create(values);
      if (result.success) {
        message.success('创建订单成功');
        setCreateModalVisible(false);
        form.resetFields();
        loadOrders();
      }
    } catch (error: any) {
      message.error(error.message || '创建失败');
    }
  };

  const handleEdit = async (values: any) => {
    if (!editingOrder) return;
    try {
      const result = await window.electronAPI.order.update(editingOrder.id, values);
      if (result.success) {
        message.success('更新订单成功');
        setEditModalVisible(false);
        setEditingOrder(null);
        loadOrders();
      }
    } catch (error: any) {
      message.error(error.message || '更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await window.electronAPI.order.delete(id);
      if (result.success) {
        message.success('删除成功');
        loadOrders();
      }
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleExportExcel = async () => {
    try {
      const orderIds = selectedRowKeys.length > 0 ? selectedRowKeys as string[] : undefined;
      const result = await window.electronAPI.export.excel(orderIds);
      if (result.success) {
        message.success(`导出成功，共 ${result.data?.count || 0} 条`);
      }
    } catch (error: any) {
      message.error('导出失败');
    }
  };

  const handleExportCSV = async () => {
    try {
      const orderIds = selectedRowKeys.length > 0 ? selectedRowKeys as string[] : undefined;
      const result = await window.electronAPI.export.csv(orderIds);
      if (result.success) {
        message.success(`导出成功，共 ${result.data?.count || 0} 条`);
      }
    } catch (error: any) {
      message.error('导出失败');
    }
  };

  const handleImport = async (filePath: string, isExcel: boolean) => {
    try {
      const result = isExcel
        ? await window.electronAPI.import.excel(filePath)
        : await window.electronAPI.import.csv(filePath);
      
      if (result.success) {
        if (result.data.failed > 0) {
          message.warning(`导入完成：成功 ${result.data.success} 条，失败 ${result.data.failed} 条`);
        } else {
          message.success(`导入成功，共 ${result.data.success} 条`);
        }
        loadOrders();
      }
    } catch (error: any) {
      message.error('导入失败');
    }
  };

  const openFileDialog = async (isExcel: boolean) => {
    const result = await window.electronAPI.file.openDialog({
      properties: ['openFile'],
      filters: [{
        name: isExcel ? 'Excel文件' : 'CSV文件',
        extensions: [isExcel ? 'xlsx' : 'csv']
      }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      handleImport(result.filePaths[0], isExcel);
    }
  };

  const downloadTemplate = async () => {
    const result = await window.electronAPI.export.template();
    if (result.success) {
      message.success('模板下载成功');
    }
  };

  const handleBatchStatusChange = async (newStatus: ReissueStatus) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择订单');
      return;
    }

    Modal.confirm({
      title: '确认批量更新状态',
      content: `确定要将选中的 ${selectedRowKeys.length} 个订单状态更新为「${STATUS_LABELS[newStatus]}」吗？`,
      onOk: async () => {
        try {
          const result = await window.electronAPI.batch.changeStatus(
            selectedRowKeys as string[],
            newStatus,
            '批量更新'
          );
          if (result.success) {
            message.success(`批量更新完成：成功 ${result.data.success.length} 条，失败 ${result.data.failed.length} 条`);
            setSelectedRowKeys([]);
            loadOrders();
          }
        } catch (error: any) {
          message.error('批量操作失败');
        }
      }
    });
  };

  const getNextStatuses = (order: ReissueOrder): string[] => {
    return STATUS_TRANSITIONS[order.status] || [];
  };

  const columns = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 180,
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>
    },
    {
      title: '客户信息',
      key: 'customer',
      width: 200,
      render: (_: any, record: ReissueOrder) => (
        <div>
          <div>{record.customerName}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{record.customerPhone}</div>
        </div>
      )
    },
    {
      title: '商品信息',
      key: 'product',
      width: 250,
      render: (_: any, record: ReissueOrder) => (
        <div>
          <div>{record.productName}</div>
          <div style={{ color: '#999', fontSize: 12 }}>
            {record.productSku} × {record.quantity}
          </div>
        </div>
      )
    },
    {
      title: '补发原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 120
    },
    {
      title: '处理人',
      dataIndex: 'assigneeName',
      key: 'assigneeName',
      width: 100,
      render: (text: string) => text || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ReissueStatus) => (
        <Tag color={STATUS_COLORS[status]}>
          {STATUS_LABELS[status]}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: ReissueOrder) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onViewDetail(record.id)}
            />
          </Tooltip>
          {hasPermission(currentUser, 'order.update') && (
            <Tooltip title="编辑">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingOrder(record);
                  form.setFieldsValue(record);
                  setEditModalVisible(true);
                }}
              />
            </Tooltip>
          )}
          {hasPermission(currentUser, 'order.delete') && (
            <Popconfirm
              title="确定删除该订单吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>补发工单</h2>
        <Space>
          {hasPermission(currentUser, 'order.create') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                setCreateModalVisible(true);
              }}
            >
              新建工单
            </Button>
          )}
          {hasPermission(currentUser, 'order.import') && (
            <Select
              placeholder="导入"
              style={{ width: 120 }}
              onSelect={(value) => {
                if (value === 'excel') openFileDialog(true);
                if (value === 'csv') openFileDialog(false);
                if (value === 'template') downloadTemplate();
              }}
            >
              <Option value="excel">导入Excel</Option>
              <Option value="csv">导入CSV</Option>
              <Option value="template">下载模板</Option>
            </Select>
          )}
          {hasPermission(currentUser, 'order.export') && (
            <Select
              placeholder="导出"
              style={{ width: 120 }}
              onSelect={(value) => {
                if (value === 'excel') handleExportExcel();
                if (value === 'csv') handleExportCSV();
              }}
            >
              <Option value="excel">导出Excel</Option>
              <Option value="csv">导出CSV</Option>
            </Select>
          )}
        </Space>
      </div>

      <div className="filter-section">
        <Row gutter={16}>
          <Col span={6}>
            <Search
              placeholder="搜索订单号"
              allowClear
              onSearch={(value) => setFilters({ ...filters, orderNo: value })}
            />
          </Col>
          <Col span={6}>
            <Input
              placeholder="搜索客户姓名"
              allowClear
              onChange={(e) => {
                setFilters({ ...filters, customerName: e.target.value });
              }}
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: '100%' }}
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker
              style={{ width: '100%' }}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates as any })}
            />
          </Col>
        </Row>
      </div>

      {hasPermission(currentUser, 'order.batch_update') && selectedRowKeys.length > 0 && (
        <div style={{ marginBottom: 16, padding: 16, background: '#e6f7ff', borderRadius: 4 }}>
          <Space>
            <span>已选择 {selectedRowKeys.length} 个订单</span>
            <Select
              placeholder="批量更新状态"
              style={{ width: 150 }}
              onSelect={(value) => handleBatchStatusChange(value as ReissueStatus)}
            >
              <Option value={ReissueStatus.PROCESSING}>开始处理</Option>
              <Option value={ReissueStatus.CANCELLED}>取消</Option>
            </Select>
            <Button onClick={() => setSelectedRowKeys([])}>取消选择</Button>
          </Space>
        </div>
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={orders}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          }
        }}
        rowSelection={hasPermission(currentUser, 'order.batch_update') ? rowSelection : undefined}
        scroll={{ x: 1400 }}
      />

      <Modal
        title="新建补发工单"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customerName"
                label="客户姓名"
                rules={[{ required: true, message: '请输入客户姓名' }]}
              >
                <Input placeholder="请输入客户姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customerPhone"
                label="客户电话"
                rules={[{ required: true, message: '请输入客户电话' }]}
              >
                <Input placeholder="请输入客户电话" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="customerAddress"
            label="客户地址"
          >
            <Input.TextArea rows={2} placeholder="请输入客户地址" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="productName"
                label="商品名称"
                rules={[{ required: true, message: '请输入商品名称' }]}
              >
                <Input placeholder="请输入商品名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="productSku"
                label="商品SKU"
              >
                <Input placeholder="请输入商品SKU" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label="数量"
                initialValue={1}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="reason"
                label="补发原因"
                rules={[{ required: true, message: '请选择补发原因' }]}
              >
                <Select placeholder="请选择补发原因">
                  <Option value="商品损坏">商品损坏</Option>
                  <Option value="发错商品">发错商品</Option>
                  <Option value="数量不足">数量不足</Option>
                  <Option value="质量问题">质量问题</Option>
                  <Option value="颜色不符">颜色不符</Option>
                  <Option value="快递丢失">快递丢失</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="description"
            label="详细描述"
          >
            <Input.TextArea rows={3} placeholder="请输入详细描述" />
          </Form.Item>
          {users.length > 0 && (
            <Form.Item
              name="assigneeId"
              label="分配给"
            >
              <Select placeholder="请选择处理人">
                {users.map(u => (
                  <Option key={u.id} value={u.id}>{u.name}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="编辑工单"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingOrder(null);
        }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEdit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customerName"
                label="客户姓名"
                rules={[{ required: true, message: '请输入客户姓名' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customerPhone"
                label="客户电话"
                rules={[{ required: true, message: '请输入客户电话' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="customerAddress"
            label="客户地址"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="productName"
                label="商品名称"
                rules={[{ required: true, message: '请输入商品名称' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="productSku"
                label="商品SKU"
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label="数量"
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="reason"
                label="补发原因"
                rules={[{ required: true, message: '请选择补发原因' }]}
              >
                <Select>
                  <Option value="商品损坏">商品损坏</Option>
                  <Option value="发错商品">发错商品</Option>
                  <Option value="数量不足">数量不足</Option>
                  <Option value="质量问题">质量问题</Option>
                  <Option value="颜色不符">颜色不符</Option>
                  <Option value="快递丢失">快递丢失</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="description"
            label="详细描述"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          {users.length > 0 && (
            <Form.Item
              name="assigneeId"
              label="分配给"
            >
              <Select>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default OrderListPage;
