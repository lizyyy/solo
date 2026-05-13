import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography } from 'antd';
import {
  ExperimentOutlined,
  SafetyCertificateOutlined,
  BlockOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

const statusColors = {
  PENDING: 'default',
  ACTIVE: 'green',
  EXPIRED: 'red',
  BLOCKED: 'orange',
  DISCARDED: 'default',
};

const experimentStatusColors = {
  PENDING: 'default',
  APPROVED: 'green',
  BLOCKED: 'red',
  REVIEWING: 'orange',
  COMPLETED: 'blue',
  CANCELLED: 'default',
};

const statusMap = {
  PENDING: '待处理',
  ACTIVE: '正常',
  EXPIRED: '已过期',
  BLOCKED: '已封锁',
  DISCARDED: '已废弃',
};

const experimentStatusMap = {
  PENDING: '待审批',
  APPROVED: '已批准',
  BLOCKED: '已拦截',
  REVIEWING: '待复核',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentExperiments, setRecentExperiments] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, experimentsRes, reviewsRes] = await Promise.all([
        api.get('/exports/statistics'),
        api.get('/experiments', { params: { limit: 5 } }),
        api.get('/reviews', { params: { limit: 5 } }),
      ]);

      setStats(statsRes.data);
      setRecentExperiments(experimentsRes.data.experiments);
      setRecentReviews(reviewsRes.data.records);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const experimentColumns = [
    {
      title: '实验编号',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '实验名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '试剂',
      dataIndex: ['batch', 'reagent', 'name'],
      key: 'reagent',
    },
    {
      title: '批号',
      dataIndex: ['batch', 'batchNumber'],
      key: 'batchNumber',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={experimentStatusColors[status]}>
          {experimentStatusMap[status]}
        </Tag>
      ),
    },
    {
      title: '预约日期',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
  ];

  const reviewColumns = [
    {
      title: '复核人',
      dataIndex: ['reviewer', 'name'],
      key: 'reviewer',
    },
    {
      title: '试剂',
      dataIndex: ['batch', 'reagent', 'name'],
      key: 'reagent',
    },
    {
      title: '决策',
      dataIndex: 'decision',
      key: 'decision',
      render: (decision) => (
        <Tag color={decision === 'APPROVE' ? 'green' : 'red'}>
          {decision === 'APPROVE' ? '通过' : '拒绝'}
        </Tag>
      ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '复核时间',
      dataIndex: 'reviewedAt',
      key: 'reviewedAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        系统概览
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="试剂批号总数"
              value={stats?.totalBatches || 0}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="已完成实验"
              value={stats?.experimentsByStatus?.find((s) => s.status === 'COMPLETED')?.count || 0}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="待拦截实验"
              value={stats?.experimentsByStatus?.find((s) => s.status === 'BLOCKED')?.count || 0}
              prefix={<BlockOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="废弃记录数"
              value={stats?.totalDiscards || 0}
              prefix={<DeleteOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="最近实验">
            <Table
              columns={experimentColumns}
              dataSource={recentExperiments}
              rowKey="id"
              pagination={false}
              size="small"
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近复核记录">
            <Table
              columns={reviewColumns}
              dataSource={recentReviews}
              rowKey="id"
              pagination={false}
              size="small"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
