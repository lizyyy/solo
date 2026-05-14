import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Space, DatePicker } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { contentApi } from '../services/api';
import { DashboardStats, ContentItem, ContentStatus, StatusLabelMap, StatusColorMap } from '../types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

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
      const [statsRes, contentRes] = await Promise.all([
        contentApi.getDashboardStats(),
        contentApi.list({ pageSize: 10 })
      ]);
      
      if (statsRes.data.success) {
        setStats(statsRes.data.data);
      }
      if (contentRes.data.success) {
        setRecentContent(contentRes.data.data.list);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = stats ? [
    { name: '草稿', value: stats.draft },
    { name: '待审核', value: stats.pendingReview },
    { name: '已排期', value: stats.scheduled },
    { name: '已发布', value: stats.published },
    { name: '发布失败', value: stats.failed },
    { name: '需复核', value: stats.needsReview }
  ] : [];

  const columns: ColumnsType<ContentItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: ContentStatus) => (
        <Tag color={StatusColorMap[status]}>{StatusLabelMap[status]}</Tag>
      )
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '重试次数',
      dataIndex: 'retryCount',
      key: 'retryCount',
      render: (count: number, record: ContentItem) => (
        <span>{count}/{record.maxRetries}</span>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="内容总数" value={stats?.total || 0} />
            </Card>
          </Col>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="待审核" value={stats?.pendingReview || 0} valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="已排期" value={stats?.scheduled || 0} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="已发布" value={stats?.published || 0} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="需复核" value={stats?.needsReview || 0} valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card loading={loading}>
              <Statistic title="发布失败" value={stats?.failed || 0} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card title="内容状态分布" loading={loading}>
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
            <Card title="内容占比" loading={loading}>
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

        <Card title="最近内容" loading={loading} extra={
          <Button type="primary" onClick={loadDashboard}>刷新</Button>
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
