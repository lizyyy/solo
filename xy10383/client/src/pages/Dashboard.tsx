import React, { useEffect, useState } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Statistic, 
  Table, 
  Tag, 
  Progress,
  Spin,
  Alert
} from 'antd';
import { 
  UserOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  WarningOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from 'recharts';
import { dashboardApi } from '../services/api';
import { IDashboardStats } from '../types';
import { STATUS_LABELS } from '../utils/constants';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<IDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await dashboardApi.getStats();
      setStats(response.data.data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) {
    return <Alert message="加载数据失败" type="error" />;
  }

  const statusChartData = [
    { name: '待分配', value: stats.pendingLeads, color: '#d9d9d9' },
    { name: '已分配', value: stats.assignedLeads, color: '#1890ff' },
    { name: '跟进中', value: stats.followingLeads, color: '#13c2c2' },
    { name: '已转化', value: stats.convertedLeads, color: '#52c41a' },
    { name: '已拒绝', value: stats.rejectedLeads, color: '#ff4d4f' },
    { name: '待复核', value: stats.needsReviewLeads, color: '#faad14' }
  ].filter(item => item.value > 0);

  const salesChartData = stats.salesStats.map(s => ({
    name: s.name,
    待跟进: s.stats.pending,
    跟进中: s.stats.following,
    已转化: s.stats.converted,
    已拒绝: s.stats.rejected
  }));

  const salesColumns = [
    {
      title: '销售人员',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <span>
          {text}
          {record.isOnVacation && <Tag color="orange" style={{ marginLeft: 8 }}>休假中</Tag>}
        </span>
      )
    },
    {
      title: '负责地区',
      dataIndex: 'regions',
      key: 'regions',
      render: (regions: string[]) => regions.join('、') || '不限'
    },
    {
      title: '当前负载',
      dataIndex: 'currentLoad',
      key: 'load',
      render: (_: any, record: any) => (
        <div>
          <span>{record.currentLoad}/{record.maxLoad}</span>
          <Progress 
            percent={parseFloat(record.loadPercentage || '0')} 
            size="small"
            status={record.currentLoad >= record.maxLoad ? 'exception' : undefined}
          />
        </div>
      )
    },
    {
      title: '待跟进',
      dataIndex: ['stats', 'pending'],
      key: 'pending'
    },
    {
      title: '跟进中',
      dataIndex: ['stats', 'following'],
      key: 'following'
    },
    {
      title: '已转化',
      dataIndex: ['stats', 'converted'],
      key: 'converted',
      render: (val: number) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{val}</span>
    },
    {
      title: '转化率',
      key: 'conversion',
      render: (_: any, record: any) => {
        const total = record.stats.following + record.stats.converted + record.stats.rejected;
        const rate = total > 0 ? ((record.stats.converted / total) * 100).toFixed(1) : 0;
        return <span>{rate}%</span>;
      }
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="总线索数"
              value={stats.totalLeads}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="待跟进"
              value={stats.assignedLeads + stats.pendingLeads}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="已转化"
              value={stats.convertedLeads}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="转化率"
              value={stats.conversionRate}
              suffix="%"
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="待复核"
              value={stats.needsReviewLeads}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="重复线索"
              value={stats.duplicateLeads}
              prefix={<CopyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="线索状态分布">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="销售业绩对比">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={60} />
                <Tooltip />
                <Legend />
                <Bar dataKey="待跟进" stackId="a" fill="#d9d9d9" />
                <Bar dataKey="跟进中" stackId="a" fill="#13c2c2" />
                <Bar dataKey="已转化" stackId="a" fill="#52c41a" />
                <Bar dataKey="已拒绝" stackId="a" fill="#ff4d4f" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="销售负载与业绩">
            <Table
              columns={salesColumns}
              dataSource={stats.salesStats}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
