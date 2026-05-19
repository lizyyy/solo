import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Alert, Table } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { dashboardApi, taskApi } from '../services/api';
import { DashboardStats, TaskTrend, SeedTask } from '../types';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<TaskTrend[]>([]);
  const [recentTasks, setRecentTasks] = useState<SeedTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, trendData, tasksData] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getTrend(7),
        taskApi.getAll({ limit: 5 }),
      ]);
      setStats(statsData);
      setTrend(trendData);
      setRecentTasks(tasksData.tasks);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const taskColumns = [
    {
      title: '环境',
      dataIndex: ['Environment', 'name'],
      key: 'environment',
    },
    {
      title: '数据集',
      dataIndex: ['Dataset', 'name'],
      key: 'dataset',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          success: { color: 'text-green-600', text: '成功' },
          failed: { color: 'text-red-600', text: '失败' },
          processing: { color: 'text-blue-600', text: '处理中' },
          rolled_back: { color: 'text-orange-600', text: '已回滚' },
        };
        const info = statusMap[status] || { color: 'text-gray-600', text: status };
        return <span className={info.color}>{info.text}</span>;
      },
    },
    {
      title: '成功记录',
      dataIndex: 'successRecords',
      key: 'successRecords',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) {
    return <Alert message="加载失败" type="error" />;
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>数据看板</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={stats.totalTasks}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="成功任务"
              value={stats.successTasks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="失败任务"
              value={stats.failedTasks}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="成功率"
              value={stats.successRate}
              suffix="%"
              precision={2}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="导入记录"
              value={stats.totalRecords}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="环境数量"
              value={stats.environments}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="数据集数"
              value={stats.datasets}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="待评审回滚"
              value={stats.pendingReview}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa541c' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="任务趋势（近7天）" style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total" name="总数" stroke="#1890ff" />
            <Line type="monotone" dataKey="success" name="成功" stroke="#52c41a" />
            <Line type="monotone" dataKey="failed" name="失败" stroke="#ff4d4f" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="最近任务">
        <Table
          columns={taskColumns}
          dataSource={recentTasks}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
