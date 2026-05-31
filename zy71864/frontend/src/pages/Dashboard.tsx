import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, Typography } from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import {
  FileDoneOutlined,
  CalendarOutlined,
  RiseOutlined,
  ExclamationCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { diagnosisApi } from '@/api';
import type { DiagnosisBatch } from '@/types';
import { formatDate, getStatusLabel, getStatusColor, getErrorTypeName } from '@/utils';

const { Title } = Typography;

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

const mockTrendData = [
  { date: '12/25', accuracy: 72, count: 45 },
  { date: '12/26', accuracy: 68, count: 52 },
  { date: '12/27', accuracy: 75, count: 48 },
  { date: '12/28', accuracy: 71, count: 60 },
  { date: '12/29', accuracy: 78, count: 55 },
  { date: '12/30', accuracy: 82, count: 58 },
  { date: '12/31', accuracy: 79, count: 62 },
];

const mockErrorDistribution = [
  { name: '公差错误', value: 15 },
  { name: '公比错误', value: 12 },
  { name: '系数错误', value: 8 },
  { name: '格式错误', value: 5 },
  { name: '常数项错误', value: 6 },
  { name: '其他', value: 3 },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<DiagnosisBatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const response = await diagnosisApi.listBatches({ limit: 10 });
      setBatches(response.data);
    } catch (error) {
      console.error('Failed to load batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '批次名称',
      dataIndex: 'batch_name',
      key: 'batch_name',
      render: (text: string, record: DiagnosisBatch) => (
        <span className="font-medium">{text}</span>
      ),
    },
    {
      title: '诊断数量',
      dataIndex: 'material_count',
      key: 'material_count',
      width: 100,
      render: (count: number) => <span className="font-mono">{count} 条</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: '是否复用',
      dataIndex: 'is_reused',
      key: 'is_reused',
      width: 100,
      render: (reused?: boolean) =>
        reused ? <Tag color="orange">复用历史</Tag> : <Tag color="green">新诊断</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: DiagnosisBatch) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/diagnosis?batchId=${record.id}`)}
        >
          查看 <ArrowRightOutlined />
        </Button>
      ),
    },
  ];

  const stats = [
    {
      title: '总诊断批次',
      value: batches.length,
      icon: <FileDoneOutlined style={{ color: '#1e3a5f', fontSize: 24 }} />,
      bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      title: '今日诊断数',
      value: 62,
      icon: <CalendarOutlined style={{ color: '#1e3a5f', fontSize: 24 }} />,
      bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      title: '平均正确率',
      value: '76.4%',
      icon: <RiseOutlined style={{ color: '#1e3a5f', fontSize: 24 }} />,
      bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
    {
      title: '待处理问题',
      value: 3,
      icon: <ExclamationCircleOutlined style={{ color: '#1e3a5f', fontSize: 24 }} />,
      bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    },
  ];

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <Title level={3} className="!m-0 !text-primary-900">
          数据概览
        </Title>
        <p className="text-gray-500 mt-1">欢迎使用数列递推诊断系统</p>
      </div>

      <Row gutter={[16, 16]} className="mb-6">
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card
              className="border-none card-hover animate-fadeIn"
              style={{ animationDelay: `${index * 50}ms` }}
              bodyStyle={{ padding: '20px' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-800 font-mono animate-countUp">
                    {stat.value}
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center opacity-90"
                  style={{ background: stat.bg }}
                >
                  {stat.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} lg={14}>
          <Card
            title="正确率趋势（近7天）"
            className="card-hover"
            extra={
              <Button type="link" size="small" onClick={() => navigate('/diagnosis')}>
                查看详情 <ArrowRightOutlined />
              </Button>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  name="正确率(%)"
                  stroke="#1e3a5f"
                  strokeWidth={3}
                  dot={{ fill: '#1e3a5f', r: 5 }}
                  activeDot={{ r: 7 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="诊断数量"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="错误类型分布" className="card-hover">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={mockErrorDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {mockErrorDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card
        title="最近诊断批次"
        className="card-hover"
        extra={
          <Button type="primary" size="small" onClick={() => navigate('/diagnosis')}>
            发起新诊断
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={batches}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default Dashboard;
