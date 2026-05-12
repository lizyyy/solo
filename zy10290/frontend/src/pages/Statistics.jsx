import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Progress } from 'antd';
import { ShoppingOutlined, DollarOutlined, GiftOutlined, RollbackOutlined } from '@ant-design/icons';
import api from '../utils/api';

const Statistics = ({ activities }) => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchAllOrders();
  }, []);

  const fetchAllOrders = async () => {
    try {
      const res = await api.get('/orders', { params: { pageSize: 1000 } });
      if (res.data.success) {
        setOrders(res.data.data.list);
      }
    } catch (error) {
      console.error('加载数据失败');
    }
  };

  const totalOrders = orders.length;
  const paidOrders = orders.filter(o => o.payment_status === 'paid').length;
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
  const refundedOrders = orders.filter(o => o.refund_status === 'completed').length;
  const compensationOrders = orders.filter(o => o.is_manual_compensation).length;

  const totalAmount = orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
  const refundAmount = orders.filter(o => o.refund_status === 'completed').reduce((sum, o) => sum + (parseFloat(o.refund_amount) || 0), 0);

  const productStats = {};
  orders.forEach(order => {
    if (!productStats[order.product_id]) {
      productStats[order.product_id] = {
        name: order.product_name,
        totalQuantity: 0,
        paidQuantity: 0,
        cancelledQuantity: 0,
        refundedQuantity: 0,
      };
    }
    productStats[order.product_id].totalQuantity += order.quantity;
    if (order.payment_status === 'paid') productStats[order.product_id].paidQuantity += order.quantity;
    if (order.status === 'cancelled') productStats[order.product_id].cancelledQuantity += order.quantity;
    if (order.refund_status === 'completed') productStats[order.product_id].refundedQuantity += order.quantity;
  });

  const columns = [
    { title: '商品名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '总下单数量', dataIndex: 'totalQuantity', key: 'totalQuantity', width: 120 },
    { title: '成功支付', dataIndex: 'paidQuantity', key: 'paidQuantity', width: 120, render: val => <Tag color="green">{val}</Tag> },
    { title: '取消订单', dataIndex: 'cancelledQuantity', key: 'cancelledQuantity', width: 120, render: val => <Tag color="red">{val}</Tag> },
    { title: '退款退货', dataIndex: 'refundedQuantity', key: 'refundedQuantity', width: 120, render: val => <Tag color="orange">{val}</Tag> },
  ];

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总订单数"
              value={totalOrders}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
            <Progress percent={totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0} status="active" />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>支付成功率 {totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0}%</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="交易金额"
              value={totalAmount}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>退款金额 ¥{refundAmount.toFixed(2)}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="取消订单"
              value={cancelledOrders}
              prefix={<GiftOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              取消率 {totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0}%
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="人工补单"
              value={compensationOrders}
              prefix={<RollbackOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>退款订单 {refundedOrders} 笔</div>
          </Card>
        </Col>
      </Row>

      <Card title="商品销售统计" style={{ marginTop: 24 }}>
        <Table
          columns={columns}
          dataSource={Object.values(productStats)}
          rowKey="name"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default Statistics;
