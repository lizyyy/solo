import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Spin, Alert } from 'antd';
import {
  StopOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { riskApi } from '../services/api';
import { DashboardStats, BlockEvent, EventStatus, RiskLevel } from '../types';
import moment from 'moment';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await riskApi.getDashboardStats();
      if (response.data.success) {
        setStats(response.data.data!);
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.CRITICAL:
      case RiskLevel.HIGH:
        return 'red';
      case RiskLevel.MEDIUM:
        return 'orange';
      default:
        return 'green';
    }
  };

  const getStatusTag = (status: EventStatus) => {
    const statusMap: Record<EventStatus, { color: string; text: string }> = {
      [EventStatus.BLOCKED]: { color: 'red', text: '已拦截' },
      [EventStatus.MANUAL_ALLOWED]: { color: 'green', text: '人工放行' },
      [EventStatus.COMPENSATED]: { color: 'blue', text: '已补偿' },
      [EventStatus.ALLOWED]: { color: 'green', text: '已放行' },
      [EventStatus.PENDING]: { color: 'orange', text: '待处理' },
    };
    const info = statusMap[status] || statusMap[EventStatus.PENDING];
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const columns = [
    {
      title: '优惠码',
      dataIndex: 'promo_code',
      key: 'promo_code',
      width: 120,
      render: (code: string) => <code style={{ background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>{code}</code>,
    },
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
    },
    {
      title: '风险评分',
      dataIndex: 'risk_score',
      key: 'risk_score',
      width: 100,
      render: (score: number) => (
        <span style={{ color: score >= 60 ? '#ff4d4f' : score >= 30 ? '#fa8c16' : '#52c41a', fontWeight: 'bold' }}>
          {score}
        </span>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (level: RiskLevel) => <Tag color={getRiskLevelColor(level)}>{level.toUpperCase()}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: EventStatus) => getStatusTag(status),
    },
    {
      title: '拦截原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载中...</div>
      </div>
    );
  }

  if (error) {
    return <Alert message="错误" description={error} type="error" />;
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="累计拦截"
              value={stats?.totalBlocked || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<StopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="今日拦截"
              value={stats?.todayBlocked || 0}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="累计放行"
              value={stats?.totalAllowed || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="待审核"
              value={stats?.pendingReview || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<WarningOutlined />}
              suffix={`/ ${stats?.totalBlocked || 0}`}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="近7日拦截趋势" className="stat-card" extra={<RiseOutlined />}>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.dailyStats || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="blocked" name="拦截数" stroke="#ff4d4f" strokeWidth={2} />
                  <Line type="monotone" dataKey="resolved" name="已处理" stroke="#52c41a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="最近拦截事件" className="stat-card">
        <Table
          columns={columns}
          dataSource={stats?.recentEvents || []}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

export default Dashboard;
