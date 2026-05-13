import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message, Popover, Descriptions } from 'antd';
import { EyeOutlined, ReloadOutlined, CheckCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '../api';
import moment from 'moment';
const OrdersList = ({ onRefresh }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);
  useEffect(() => {
    loadOrders();
  }, []);
  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/orders');
      if (response.data.success) {
        setOrders(response.data.data);
      }
    } catch (error) {
      message.error('加载订单列表失败');
    }
    setLoading(false);
  };
  const showOrderDetail = async (order) => {
    setSelectedOrder(order);
    try {
      const response = await api.get(`/orders/${order.id}`);
      if (response.data.success) {
        setOrderDetail(response.data.data);
      }
    } catch (error) {
      message.error('加载订单详情失败');
    }
  };
  const showHistory = async (order) => {
    try {
      const response = await api.get(`/history?business_type=order&business_id=${order.id}`);
      if (response.data.success) {
        setHistoryRecords(response.data.data);
        Modal.info({
          title: '状态变更历史',
          width: 700,
          content: (
            <Table
              dataSource={response.data.data}
              rowKey="id"
              columns={[
                { title: '变更前状态', dataIndex: 'before_status', key: 'before_status' },
                { title: '变更后状态', dataIndex: 'after_status', key: 'after_status' },
                { title: '操作人', dataIndex: 'operator', key: 'operator' },
                { title: '备注', dataIndex: 'remark', key: 'remark' },
                { title: '操作时间', dataIndex: 'created_at', key: 'created_at', render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss') },
              ]}
            />
          ),
        });
      }
    } catch (error) {
      message.error('加载历史记录失败');
    }
  };
  const checkQualification = async (order) => {
    Modal.confirm({
      title: '确认赠品资格检查',
      content: `确定要对订单 ${order.order_no} 进行赠品资格检查吗？`,
      onOk: async () => {
        try {
          const response = await api.post(`/orders/${order.id}/check-qualification`, {
            operator: '当前用户'
          });
          if (response.data.success) {
            const data = response.data.data;
            message.success(data.qualified ? '订单满足赠品资格！' : '订单不满足赠品资格或库存不足');
            loadOrders();
            onRefresh && onRefresh();
          }
        } catch (error) {
          message.error(error.response?.data?.error || '资格检查失败');
        }
      },
    });
  };
  const getStatusTag = (status) => {
    const statusMap = {
      'pending': { color: 'default', text: '待处理' },
      'gift_qualified': { color: 'success', text: '已获赠' },
      'gift_not_qualified': { color: 'error', text: '未达标' },
      'gift_cancelled': { color: 'warning', text: '赠品取消' },
      'split': { color: 'processing', text: '已拆单' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };
  const columns = [
    { title: '订单号', dataIndex: 'order_no', key: 'order_no', width: 150 },
    { title: '用户', dataIndex: 'user_name', key: 'user_name', width: 100 },
    { title: '订单金额', dataIndex: 'total_amount', key: 'total_amount', width: 100, render: (val) => `¥${val}` },
    { title: '赠品资格', dataIndex: 'gift_qualified', key: 'gift_qualified', width: 100, render: (val) => val ? <Tag color="success">是</Tag> : <Tag color="error">否</Tag> },
    { title: '赠品数量', dataIndex: 'gift_quantity', key: 'gift_quantity', width: 100 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: getStatusTag },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss') },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" icon={<EyeOutlined />} onClick={() => showOrderDetail(record)}>详情</Button>
          <Button type="link" icon={<CheckCircleOutlined />} onClick={() => checkQualification(record)}>资格检查</Button>
          <Button type="link" icon={<HistoryOutlined />} onClick={() => showHistory(record)}>历史</Button>
        </Space>
      ),
    },
  ];
  return (
    <div>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button icon={<ReloadOutlined />} onClick={loadOrders}>刷新</Button>
      </div>
      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title="订单详情"
        open={!!selectedOrder}
        onCancel={() => { setSelectedOrder(null); setOrderDetail(null); }}
        footer={null}
        width={800}
      >
        {orderDetail && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="订单号" span={2}>{orderDetail.order_no}</Descriptions.Item>
            <Descriptions.Item label="用户">{orderDetail.user_name}</Descriptions.Item>
            <Descriptions.Item label="订单金额">¥{orderDetail.total_amount}</Descriptions.Item>
            <Descriptions.Item label="赠品资格">{orderDetail.gift_qualified ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="赠品数量">{orderDetail.gift_quantity}</Descriptions.Item>
            <Descriptions.Item label="状态" span={2}>{getStatusTag(orderDetail.status)}</Descriptions.Item>
            <Descriptions.Item label="订单项" span={2}>
              <Table
                dataSource={orderDetail.items || []}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  { title: '商品名称', dataIndex: 'product_name', key: 'product_name' },
                  { title: '单价', dataIndex: 'price', key: 'price', render: (val) => `¥${val}` },
                  { title: '数量', dataIndex: 'quantity', key: 'quantity' },
                  { title: '金额', dataIndex: 'amount', key: 'amount', render: (val) => `¥${val}` },
                  { title: '是否赠品', dataIndex: 'is_gift', key: 'is_gift', render: (val) => val ? '是' : '否' },
                ]}
              />
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
export default OrdersList;
