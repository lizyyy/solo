import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Space, Typography } from 'antd';
import {
  GiftOutlined,
  CalendarOutlined,
  UserOutlined,
  WarningOutlined,
  RollbackOutlined,
  ShoppingOutlined
} from '@ant-design/icons';
import { statsAPI, exceptionsAPI } from '../services/api';

const { Title } = Typography;

function Dashboard() {
  const [stats, setStats] = useState({});
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, exceptionsRes] = await Promise.all([
        statsAPI.getStats(),
        exceptionsAPI.getAll({ status: 'pending' })
      ]);
      setStats(statsRes.data.data || {});
      setExceptions(exceptionsRes.data.data || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const exceptionColumns = [
    {
      title: '异常类型',
      dataIndex: 'exception_type',
      key: 'exception_type',
      width: 120
    },
    {
      title: '相关模块',
      dataIndex: 'related_module',
      key: 'related_module',
      width: 100
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'pending' ? 'orange' : 'green'}>
          {status === 'pending' ? '待处理' : '已处理'}
        </Tag>
      )
    }
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>数据概览</Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="礼品库存数"
              value={stats.inventory?.count || 0}
              prefix={<GiftOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="活动计划数"
              value={stats.plans?.count || 0}
              prefix={<CalendarOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="客户名单数"
              value={stats.customers?.count || 0}
              prefix={<UserOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="待处理领用"
              value={stats.pending_claims?.count || 0}
              prefix={<ShoppingOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="待处理异常"
              value={stats.pending_exceptions?.count || 0}
              prefix={<WarningOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="退回入库数"
              value={stats.returns?.count || 0}
              prefix={<RollbackOutlined style={{ color: '#13c2c2' }} />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="待处理异常列表" style={{ marginBottom: 24 }}>
        <Table
          columns={exceptionColumns}
          dataSource={exceptions}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
}

export default Dashboard;
