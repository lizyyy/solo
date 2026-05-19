import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Space, Typography } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { contentApi } from '../services/api';
import { DashboardStats, ContentItem, ContentStatus, StatusLabelMap, StatusColorMap } from '../types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title } = Typography;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [statsResult, contentResult] = await Promise.all([
        contentApi.getDashboardStats(),
        contentApi.list({ pageSize: 10 })
      ]);
      
      if (statsResult.success) {
        setStats(statsResult.data || null);
      } else {
        console.error('Failed to load stats:', statsResult.message);
      }
      
      if (contentResult.success) {
        setRecentContent(contentResult.data?.list || []);
      } else {
        console.error('Failed to load content list:', contentResult.message);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = stats ? [
    { name: 'Draft', value: stats.draft },
    { name: 'Pending Review', value: stats.pendingReview },
    { name: 'Scheduled', value: stats.scheduled },
    { name: 'Published', value: stats.published },
    { name: 'Failed', value: stats.failed },
    { name: 'Needs Review', value: stats.needsReview }
  ] : [];

  const columns: ColumnsType<ContentItem> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 200
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: ContentStatus) => (
        <Tag color={StatusColorMap[status]}>{StatusLabelMap[status]}</Tag>
      )
    },
    {
      title: 'Author',
      dataIndex: 'author',
      key: 'author',
      width: 100
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: 'Retry Count',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 100,
      render: (count: number, record: ContentItem) => `${count}/${record.maxRetries}`
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={3} style={{ margin: 0 }}>Dashboard</Title>

        <Row gutter={[16, 16]}>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="Total Content" value={stats?.total || 0} />
            </Card>
          </Col>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="Pending Review" value={stats?.pendingReview || 0} valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="Scheduled" value={stats?.scheduled || 0} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="Published" value={stats?.published || 0} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="Needs Review" value={stats?.needsReview || 0} valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="Failed" value={stats?.failed || 0} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card title="Content Status Distribution" loading={loading}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1890ff" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Content Distribution" loading={loading}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData.filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.filter(item => item.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Card title="Recent Content" loading={loading} extra={
          <Button type="primary" onClick={loadDashboard}>Refresh</Button>
        }>
          <Table
            columns={columns}
            dataSource={recentContent}
            rowKey="id"
            pagination={false}
          />
        </Card>
      </Space>
    </div>
  );
};

export default Dashboard;
