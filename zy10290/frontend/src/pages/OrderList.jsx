import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Select, 
  Input, 
  Tag, 
  Modal, 
  Form, 
  message, 
  Descriptions, 
  Timeline,
  Card,
  Row,
  Col,
  Statistic
} from 'antd';
import { 
  SearchOutlined, 
  ExportOutlined, 
  EyeOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  TruckOutlined,
  RollbackOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';

const { Option } = Select;
const { TextArea } = Input;

const OrderList = ({ activities }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({});
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [compensationModalVisible, setCompensationModalVisible] = useState(false);
  const [shipModalVisible, setShipModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchOrders = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = { page, pageSize, ...filters };
      const res = await api.get('/orders', { params });
      if (res.data.success) {
        setOrders(res.data.data.list);
        setPagination({
          current: page,
          pageSize,
          total: res.data.data.total,
        });
      }
    } catch (error) {
      message.error('加载订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(1, 20);
  }, [filters]);

  const handleTableChange = (pagination) => {
    fetchOrders(pagination.current, pagination.pageSize);
  };

  const viewOrderDetail = async (orderId) => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      if (res.data.success) {
        setCurrentOrder(res.data.data);
        setDetailVisible(true);
      }
    } catch (error) {
      message.error('加载订单详情失败');
    }
  };

  const handleApplyCompensation = async (values) => {
    try {
      await api.post(`/orders/${currentOrder.id}/compensation`, {
        ...values,
        applicantId: 'current_user',
        applicantName: '当前操作员',
      });
      message.success('补单申请已提交');
      setCompensationModalVisible(false);
      form.resetFields();
      fetchOrders(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('提交失败');
    }
  };

  const handleApproveCompensation = async (values) => {
    try {
      const pendingApp = currentOrder.applications.find(a => a.status === 'pending');
      await api.post(`/orders/compensation/${pendingApp.id}/approve`, {
        ...values,
        reviewerId: 'current_user',
        reviewerName: '当前操作员',
      });
      message.success('补单已批准');
      setApproveModalVisible(false);
      form.resetFields();
      fetchOrders(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleRejectCompensation = async (values) => {
    try {
      const pendingApp = currentOrder.applications.find(a => a.status === 'pending');
      await api.post(`/orders/compensation/${pendingApp.id}/reject`, {
        ...values,
        reviewerId: 'current_user',
        reviewerName: '当前操作员',
      });
      message.success('补单已拒绝');
      setRejectModalVisible(false);
      form.resetFields();
      fetchOrders(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleShip = async (values) => {
    try {
      await api.post(`/orders/${currentOrder.id}/ship`, {
        ...values,
        operatorId: 'current_user',
        operatorName: '当前操作员',
      });
      message.success('发货成功');
      setShipModalVisible(false);
      form.resetFields();
      fetchOrders(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('发货失败');
    }
  };

  const handleRefund = async (values) => {
    try {
      await api.post(`/orders/${currentOrder.id}/refund`, {
        ...values,
        operatorId: 'current_user',
        operatorName: '当前操作员',
      });
      message.success('退款成功');
      setRefundModalVisible(false);
      form.resetFields();
      fetchOrders(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('退款失败');
    }
  };

  const handleExport = () => {
    const headers = ['订单号', '活动', '商品', '用户', '数量', '金额', '状态', '支付状态', '创建时间'];
    const rows = orders.map(order => [
      order.order_no,
      order.activity_name,
      order.product_name,
      order.user_name,
      order.quantity,
      order.total_amount,
      getStatusText(order.status),
      getPaymentStatusText(order.payment_status),
      dayjs(order.created_at).format('YYYY-MM-DD HH:mm:ss')
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders_${dayjs().format('YYYYMMDDHHmmss')}.csv`;
    link.click();
    message.success('导出成功');
  };

  const getStatusColor = (status) => {
    const colors = { pending: 'orange', confirmed: 'green', cancelled: 'red', completed: 'blue' };
    return colors[status] || 'default';
  };

  const getStatusText = (status) => {
    const texts = { pending: '待确认', confirmed: '已确认', cancelled: '已取消', completed: '已完成' };
    return texts[status] || status;
  };

  const getPaymentStatusColor = (status) => {
    const colors = { unpaid: 'orange', paid: 'green', failed: 'red', refunded: 'purple' };
    return colors[status] || 'default';
  };

  const getPaymentStatusText = (status) => {
    const texts = { unpaid: '未支付', paid: '已支付', failed: '支付失败', refunding: '退款中', refunded: '已退款', partial_refunded: '部分退款' };
    return texts[status] || status;
  };

  const columns = [
    { title: '订单号', dataIndex: 'order_no', key: 'order_no', width: 160 },
    { title: '活动', dataIndex: 'activity_name', key: 'activity_name', width: 150 },
    { title: '商品', dataIndex: 'product_name', key: 'product_name', width: 150 },
    { title: '用户', dataIndex: 'user_name', key: 'user_name', width: 100 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
    { title: '金额', dataIndex: 'total_amount', key: 'total_amount', width: 100, render: val => `¥${val}` },
    { title: '订单状态', dataIndex: 'status', key: 'status', width: 100, render: val => <Tag color={getStatusColor(val)}>{getStatusText(val)}</Tag> },
    { title: '支付状态', dataIndex: 'payment_status', key: 'payment_status', width: 100, render: val => <Tag color={getPaymentStatusColor(val)}>{getPaymentStatusText(val)}</Tag> },
    { title: '补单标记', dataIndex: 'is_manual_compensation', key: 'is_manual_compensation', width: 100, render: val => val ? <Tag color="purple">人工补单</Tag> : '-' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: val => dayjs(val).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => viewOrderDetail(record.id)}>详情</Button>
          {record.payment_status !== 'paid' && !record.is_manual_compensation && !record.compensation_reject_reason && (
            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setCurrentOrder(record); setCompensationModalVisible(true); }}>申请补单</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Select
              placeholder="选择活动"
              style={{ width: '100%' }}
              allowClear
              onChange={(val) => setFilters({ ...filters, activityId: val })}
            >
              {activities.map(act => (
                <Option key={act.id} value={act.id}>{act.name}</Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="订单状态"
              style={{ width: '100%' }}
              allowClear
              onChange={(val) => setFilters({ ...filters, status: val })}
            >
              <Option value="pending">待确认</Option>
              <Option value="confirmed">已确认</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="支付状态"
              style={{ width: '100%' }}
              allowClear
              onChange={(val) => setFilters({ ...filters, paymentStatus: val })}
            >
              <Option value="unpaid">未支付</Option>
              <Option value="paid">已支付</Option>
              <Option value="failed">支付失败</Option>
              <Option value="refunded">已退款</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Space>
              <Input.Search
                placeholder="订单号/用户名"
                style={{ width: 200 }}
                allowClear
                enterButton={<SearchOutlined />}
                onSearch={(val) => setFilters({ ...filters, orderNo: val, userName: val })}
              />
              <Button icon={<ExportOutlined />} onClick={handleExport}>
                导出
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        scroll={{ x: 1400 }}
      />

      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={1000}
        footer={[
          <Space>
            {currentOrder?.payment_status !== 'paid' && !currentOrder?.is_manual_compensation && 
             !currentOrder?.compensation_reject_reason && !currentOrder?.applications?.find(a => a.status === 'pending' || a.status === 'approved') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCompensationModalVisible(true); }}>申请补单</Button>
            )}
            {currentOrder?.applications?.find(a => a.status === 'pending') && (
              <>
                <Button type="primary" icon={<CheckOutlined /> } onClick={() => setApproveModalVisible(true)}>批准补单</Button>
                <Button danger icon={<CloseOutlined /> } onClick={() => setRejectModalVisible(true)}>拒绝补单</Button>
              </>
            )}
            {currentOrder?.payment_status === 'paid' && currentOrder?.status === 'confirmed' && 
             currentOrder?.shipping_status !== 'shipped' && currentOrder?.refund_status !== 'completed' && (
              <Button type="primary" icon={<TruckOutlined /> } onClick={() => setShipModalVisible(true)}>发货</Button>
            )}
            {currentOrder?.payment_status === 'paid' && currentOrder?.status === 'confirmed' && 
             currentOrder?.refund_status !== 'completed' && (
              <Button danger icon={<RollbackOutlined /> } onClick={() => setRefundModalVisible(true)}>
                {currentOrder?.shipping_status === 'shipped' ? '退货退款' : '取消退款'}
              </Button>
            )}
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
          </Space>
        ]}
      >
        {currentOrder && (
          <>
            <Descriptions title="基本信息" bordered column={2}>
              <Descriptions.Item label="订单号">{currentOrder.order_no}</Descriptions.Item>
              <Descriptions.Item label="活动名称">{currentOrder.activity_name}</Descriptions.Item>
              <Descriptions.Item label="商品名称">{currentOrder.product_name}</Descriptions.Item>
              <Descriptions.Item label="SKU">{currentOrder.sku || '-'}</Descriptions.Item>
              <Descriptions.Item label="用户姓名">{currentOrder.user_name}</Descriptions.Item>
              <Descriptions.Item label="手机号">{currentOrder.user_phone}</Descriptions.Item>
              <Descriptions.Item label="购买数量">{currentOrder.quantity}</Descriptions.Item>
              <Descriptions.Item label="订单金额">¥{currentOrder.total_amount}</Descriptions.Item>
              <Descriptions.Item label="订单状态"><Tag color={getStatusColor(currentOrder.status)}>{getStatusText(currentOrder.status)}</Tag></Descriptions.Item>
              <Descriptions.Item label="支付状态"><Tag color={getPaymentStatusColor(currentOrder.payment_status)}>{getPaymentStatusText(currentOrder.payment_status)}</Tag></Descriptions.Item>
              {currentOrder.is_manual_compensation && (
                <Descriptions.Item label="补单信息" span={2}>
                  <Tag color="purple">人工补单</Tag>
                  {currentOrder.compensation_approve_time && ` - 批准时间: ${dayjs(currentOrder.compensation_approve_time).format('YYYY-MM-DD HH:mm')}`}
                </Descriptions.Item>
              )}
              {currentOrder.compensation_reject_reason && (
                <Descriptions.Item label="补单拒绝原因" span={2}>{currentOrder.compensation_reject_reason}</Descriptions.Item>
              )}
            </Descriptions>

            {currentOrder.applications && currentOrder.applications.length > 0 && (
              <Card title="补单申请记录" style={{ marginTop: 16 }}>
                <Timeline>
                  {currentOrder.applications.map(app => (
                    <Timeline.Item key={app.id}>
                      <p><strong>申请人:</strong> {app.applicant_name} - {dayjs(app.created_at).format('YYYY-MM-DD HH:mm')}</p>
                      <p><strong>申请原因:</strong> {app.apply_reason}</p>
                      <p><strong>状态:</strong> <Tag color={app.status === 'approved' ? 'green' : app.status === 'rejected' ? 'red' : 'orange'}>
                        {app.status === 'approved' ? '已批准' : app.status === 'rejected' ? '已拒绝' : '待审核'}
                      </Tag></p>
                      {app.review_remark && <p><strong>审核意见:</strong> {app.review_remark} - {app.reviewer_name}</p>}
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}

            {currentOrder.inventory_logs && currentOrder.inventory_logs.length > 0 && (
              <Card title="库存变动记录" style={{ marginTop: 16 }}>
                <Table
                  dataSource={currentOrder.inventory_logs}
                  rowKey="id"
                  pagination={false}
                  size="small"
                >
                  <Table.Column title="变动类型" dataIndex="change_type" key="change_type" render={val => <Tag>{val}</Tag>} />
                  <Table.Column title="变动数量" dataIndex="change_quantity" key="change_quantity" />
                  <Table.Column title="操作人" dataIndex="operator_name" key="operator_name" />
                  <Table.Column title="备注" dataIndex="remark" key="remark" />
                  <Table.Column title="时间" dataIndex="created_at" key="created_at" render={val => dayjs(val).format('YYYY-MM-DD HH:mm')} />
                </Table>
              </Card>
            )}
          </>
        )}
      </Modal>

      <Modal title="申请补单" open={compensationModalVisible} onCancel={() => setCompensationModalVisible(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleApplyCompensation}>
          <Form.Item name="applyReason" rules={[{ required: true, message: '请输入申请原因' }]}>
            <TextArea rows={4} placeholder="请输入补单申请原因..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="批准补单" open={approveModalVisible} onCancel={() => setApproveModalVisible(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleApproveCompensation}>
          <Form.Item name="reviewRemark">
            <TextArea rows={4} placeholder="请输入审核意见（可选）..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="拒绝补单" open={rejectModalVisible} onCancel={() => setRejectModalVisible(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleRejectCompensation}>
          <Form.Item name="rejectReason" rules={[{ required: true, message: '请输入拒绝原因' }]}>
            <TextArea rows={4} placeholder="请输入拒绝原因..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="发货" open={shipModalVisible} onCancel={() => setShipModalVisible(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleShip}>
          <Form.Item name="trackingNo" rules={[{ required: true, message: '请输入物流单号' }]}>
            <Input placeholder="请输入物流单号..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={currentOrder?.shipping_status === 'shipped' ? '退货退款' : '取消退款'} open={refundModalVisible} onCancel={() => setRefundModalVisible(false)} onOk={() => form.submit()}>
        <Form form={form} onFinish={handleRefund} initialValues={{ returnStock: currentOrder?.shipping_status === 'shipped' }}>
          <Form.Item name="refundAmount" rules={[{ required: true, message: '请输入退款金额' }]}>
            <Input type="number" placeholder="请输入退款金额..." prefix="¥" />
          </Form.Item>
          <Form.Item name="returnStock" valuePropName="checked">
            <Select disabled={currentOrder?.shipping_status !== 'shipped'}>
              <Option value={true}>退回库存</Option>
              <Option value={false}>不退回库存</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OrderList;
