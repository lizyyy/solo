import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Empty, List, Alert } from 'antd';
import { CalendarOutlined, ClockCircleOutlined, WarningOutlined, DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { dashboardAPI, repairOrderAPI } from '../services/api';
import { STATUS_COLOR } from '../utils/status';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [lowStockParts, setLowStockParts] = useState([]);
  const [overdueOrders, setOverdueOrders] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, lowStockRes, overdueRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getLowStock(),
        dashboardAPI.getOverdueOrders(),
      ]);

      setStats(statsRes.data);
      setLowStockParts(lowStockRes.data);
      setOverdueOrders(overdueRes.data);

      const ordersRes = await repairOrderAPI.getAll({ limit: 10 });
      setRecentOrders(ordersRes.data);
    } catch (error) {
      console.error('加载概览数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const orderColumns = [
    {
      title: '订单编号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 140,
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 100,
    },
    {
      title: '设备类型',
      dataIndex: 'device_type',
      key: 'device_type',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={STATUS_COLOR[status] || 'default'}>{status}</Tag>
      ),
    },
    {
      title: '预约时间',
      dataIndex: 'appointment_time',
      key: 'appointment_time',
      width: 160,
      render: (time) => (time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '预计费用',
      dataIndex: 'estimated_cost',
      key: 'estimated_cost',
      width: 100,
      render: (cost) => `¥${cost || 0}`,
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="今日预约数"
              value={stats?.today_appointments || 0}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="逾期待处理"
              value={stats?.overdue_orders || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="低库存备件"
              value={stats?.low_stock_items || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="近7天收入"
              value={stats?.last_7_days_income || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              suffix="元"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12} style={{ marginBottom: 16 }}>
          <Card title="低库存预警" size="small">
            {lowStockParts.length === 0 ? (
              <Empty description="暂无低库存备件" style={{ padding: '20px 0' }} />
            ) : (
              <List
                dataSource={lowStockParts}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <span>
                          {item.name}
                          <Tag color="red" style={{ marginLeft: 8 }}>低库存</Tag>
                        </span>
                      }
                      description={`SKU: ${item.sku || '-'} | 分类: ${item.category || '未分类'}`}
                    />
                    <div>
                      <span className="low-stock">
                        库存: {item.stock_quantity} {item.unit} (最低库存: {item.min_stock})
                      </span>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12} style={{ marginBottom: 16 }}>
          <Card title="逾期订单" size="small">
            {overdueOrders.length === 0 ? (
              <Empty description="暂无逾期订单" style={{ padding: '20px 0' }} />
            ) : (
              <List
                dataSource={overdueOrders}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <span>
                          {item.order_no}
                          <Tag color="orange" style={{ marginLeft: 8 }}>逾期</Tag>
                        </span>
                      }
                      description={`客户: ${item.customer_name} | 设备: ${item.device_type}`}
                    />
                    <div>
                      <Tag color={STATUS_COLOR[item.status]}>{item.status}</Tag>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        预约: {item.appointment_time ? dayjs(item.appointment_time).format('YYYY-MM-DD HH:mm') : '-'}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="最近维修单" style={{ marginTop: 16 }}>
        {recentOrders.length === 0 ? (
          <Empty description="暂无维修单" />
        ) : (
          <Table
            columns={orderColumns}
            dataSource={recentOrders}
            rowKey="id"
            pagination={false}
            size="small"
          />
        )}
      </Card>
    </div>
  );
}

export default Dashboard;
