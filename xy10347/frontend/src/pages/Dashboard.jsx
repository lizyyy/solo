import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Button, Tag, Space, Statistic, DatePicker, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

function Dashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalAmount: 0,
    totalCommission: 0,
    pendingSettlements: 0
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [abnormalOrders, setAbnormalOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [leaderboardRes, abnormalRes, ordersRes, settlementsRes] = await Promise.all([
        axios.get('/api/stats/leaderboard', { params: { period: selectedPeriod } }),
        axios.get('/api/stats/abnormal-orders'),
        axios.get('/api/orders'),
        axios.get('/api/settlements')
      ]);

      const orders = ordersRes.data;
      const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'partially_refunded');
      
      setStats({
        totalOrders: paidOrders.length,
        totalAmount: paidOrders.reduce((sum, o) => sum + (o.final_price - o.refund_amount), 0),
        totalCommission: paidOrders.reduce((sum, o) => sum + o.commission_amount, 0),
        pendingSettlements: paidOrders.filter(o => o.is_settled === 0).length
      });

      setLeaderboard(leaderboardRes.data);
      setAbnormalOrders(abnormalRes.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [selectedPeriod]);

  const leaderboardColumns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (_, __, index) => {
        const rank = index + 1;
        let rankClass = 'rank-default';
        if (rank === 1) rankClass = 'rank-1';
        else if (rank === 2) rankClass = 'rank-2';
        else if (rank === 3) rankClass = 'rank-3';
        return (
          <div className={`leaderboard-rank ${rankClass}`}>
            {rank}
          </div>
        );
      }
    },
    {
      title: '团长',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '订单数',
      dataIndex: 'total_orders',
      key: 'total_orders'
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '总佣金',
      dataIndex: 'total_commission',
      key: 'total_commission',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '返佣比例',
      dataIndex: 'commission_rate',
      key: 'commission_rate',
      render: v => `${(v * 100).toFixed(0)}%`
    }
  ];

  const abnormalColumns = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      ellipsis: true
    },
    {
      title: '学员',
      dataIndex: 'student_name',
      key: 'student_name'
    },
    {
      title: '课程',
      dataIndex: 'course_name',
      key: 'course_name'
    },
    {
      title: '实付',
      dataIndex: 'final_price',
      key: 'final_price',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '退款',
      dataIndex: 'refund_amount',
      key: 'refund_amount',
      render: v => v > 0 ? <span className="diff-negative">¥{v.toFixed(2)}</span> : '-'
    },
    {
      title: '佣金',
      dataIndex: 'commission_amount',
      key: 'commission_amount',
      render: v => `¥${v.toFixed(2)}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: status => {
        const statusMap = {
          'paid': { color: 'green', text: '已付款' },
          'pending': { color: 'default', text: '待付款' },
          'partially_refunded': { color: 'orange', text: '部分退款' },
          'refunded': { color: 'red', text: '已退款' }
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    {
      title: '是否结算',
      dataIndex: 'is_settled',
      key: 'is_settled',
      render: v => v ? <Tag color="blue">已结算</Tag> : <Tag color="default">未结算</Tag>
    }
  ];

  const handlePeriodChange = (dates) => {
    if (dates) {
      setSelectedPeriod(dates[0].format('YYYY-MM'));
    } else {
      setSelectedPeriod(null);
    }
  };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <div className="stat-card blue">
            <div className="stat-value">{stats.totalOrders}</div>
            <div className="stat-label">有效订单数</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stat-card green">
            <div className="stat-value">¥{stats.totalAmount.toFixed(2)}</div>
            <div className="stat-label">总销售额</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stat-card orange">
            <div className="stat-value">¥{stats.totalCommission.toFixed(2)}</div>
            <div className="stat-label">总佣金</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="stat-card purple">
            <div className="stat-value">{stats.pendingSettlements}</div>
            <div className="stat-label">待结算订单</div>
          </div>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={16}>
          <Card 
            title="团长排行榜" 
            loading={loading}
            extra={
              <Space>
                <RangePicker 
                  picker="month" 
                  onChange={handlePeriodChange}
                  placeholder={['开始月', '结束月']}
                />
                <Button icon={<ReloadOutlined />} onClick={loadStats}>刷新</Button>
              </Space>
            }
          >
            <Table
              columns={leaderboardColumns}
              dataSource={leaderboard}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card 
            title="异常订单" 
            loading={loading}
            extra={<Tag color="red">{abnormalOrders.length} 条</Tag>}
          >
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {abnormalOrders.slice(0, 5).map(order => (
                <div key={order.id} className="abnormal-order">
                  <div style={{ fontWeight: 'bold' }}>{order.student_name} - {order.course_name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    实付: ¥{order.final_price.toFixed(2)} | 
                    退款: <span style={{ color: '#ff4d4f' }}>¥{order.refund_amount.toFixed(2)}</span> |
                    佣金: ¥{order.commission_amount.toFixed(2)}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Tag color={order.status === 'refunded' ? 'red' : 'orange'}>
                      {order.status === 'refunded' ? '已退款' : '部分退款'}
                    </Tag>
                    <Tag color={order.is_settled ? 'blue' : 'default'}>
                      {order.is_settled ? '已结算' : '未结算'}
                    </Tag>
                  </div>
                </div>
              ))}
              {abnormalOrders.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                  暂无异常订单
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="所有订单" style={{ marginTop: 24 }}>
        <Table
          columns={abnormalColumns}
          dataSource={abnormalOrders}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

export default Dashboard;
