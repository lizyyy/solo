import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Progress, message } from 'antd';
import { ArrowUpOutlined, ShoppingOutlined, TruckOutlined, CheckSquareOutlined, AlertOutlined, DollarOutlined } from '@ant-design/icons';
import { dashboardApi } from '../api';

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getData();
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const inspectorColumns = [
    { title: '质检员', dataIndex: 'inspector', key: 'inspector' },
    { title: '总验收数', dataIndex: 'total', key: 'total' },
    { title: '通过数', dataIndex: 'accepted', key: 'accepted' },
    { title: '拒收数', dataIndex: 'rejected', key: 'rejected' },
    {
      title: '通过率',
      key: 'rate',
      render: (_, record) => (
        <Progress percent={record.total ? Math.round((record.accepted / record.total) * 100) : 0} size="small" />
      )
    }
  ];

  const responsibleColumns = [
    { title: '责任人', dataIndex: 'person', key: 'person' },
    { title: '总订单数', dataIndex: 'total', key: 'total' },
    { title: '已完成', dataIndex: 'completed', key: 'completed' },
    {
      title: '完成率',
      key: 'rate',
      render: (_, record) => (
        <Progress percent={record.total ? Math.round((record.completed / record.total) * 100) : 0} size="small" status="active" />
      )
    }
  ];

  if (!data) return null;

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>数据概览</h2>
      
      <Row gutter={[16, 16]} className="dashboard-summary">
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="订单总数"
              value={data.orders.total}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="blue">待送货: {data.orders.pending}</Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="送货总数"
              value={data.deliveries.total}
              prefix={<TruckOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="red">拒收: {data.deliveries.rejected}</Tag>
              <Tag color="orange">退货: {data.deliveries.returned}</Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="验收总数"
              value={data.inspections.total}
              prefix={<CheckSquareOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="warning">待退货: {data.inspections.pendingReturns}</Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="订单总金额"
              value={data.orders.totalAmount}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#fa8c16' }}
              suffix="元"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="总验收数量"
              value={data.inspections.totalInspected}
              prefix={<CheckSquareOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card className="stat-card">
            <Statistic
              title="拒收数量"
              value={data.inspections.totalRejected}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
              valueRender={(v) => <span className="error-text">{v}</span>}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="质检员统计" className="table-container" loading={loading}>
            <Table
              dataSource={data.inspectorStats}
              columns={inspectorColumns}
              rowKey="inspector"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="责任人统计" className="table-container" loading={loading}>
            <Table
              dataSource={data.responsibleStats}
              columns={responsibleColumns}
              rowKey="person"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
