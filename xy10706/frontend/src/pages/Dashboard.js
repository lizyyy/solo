import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Spin, message } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  RetweetOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { quotaApi } from '../services/api';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({});
  const [recentCalls, setRecentCalls] = useState([]);
  const [trendData, setTrendData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, callsRes, trendRes] = await Promise.all([
        quotaApi.getStatistics(),
        quotaApi.getCallRecords({ limit: 10 }),
        quotaApi.getDailyTrend({ days: 7 }),
      ]);

      setStatistics(statsRes.data);
      setRecentCalls(callsRes.data.records || []);

      const formattedTrend = formatTrendData(trendRes.data.trend || []);
      setTrendData(formattedTrend);
    } catch (error) {
      message.error('获取数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatTrendData = (trend) => {
    const grouped = {};
    trend.forEach(item => {
      const date = item.date;
      if (!grouped[date]) {
        grouped[date] = { date };
      }
      grouped[date][item.status] = parseInt(item.count);
    });
    return Object.values(grouped);
  };

  const getStatusTag = (status) => {
    const statusMap = {
      success: { text: '成功', class: 'status-success' },
      pending_review: { text: '待复核', class: 'status-pending' },
      blocked: { text: '已拦截', class: 'status-blocked' },
      retryable: { text: '可重试', class: 'status-retryable' },
    };
    const config = statusMap[status] || { text: status, class: '' };
    return <span className={config.class}>{config.text}</span>;
  };

  const columns = [
    {
      title: '请求ID',
      dataIndex: 'requestId',
      key: 'requestId',
      ellipsis: true,
      width: 180,
    },
    {
      title: '客户',
      dataIndex: ['Customer', 'name'],
      key: 'customer',
    },
    {
      title: '接口',
      key: 'endpoint',
      render: (_, record) => `${record.ApiEndpoint?.method} ${record.ApiEndpoint?.path}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '成本',
      dataIndex: 'cost',
      key: 'cost',
    },
  ];

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="总调用次数"
              value={statistics.totalCalls || 0}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="成功调用"
              value={statistics.successCalls || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix={<span style={{ fontSize: 14 }}>成功率 {statistics.successRate || 0}%</span>}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="待复核"
              value={statistics.pendingCalls || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="已拦截"
              value={statistics.blockedCalls || 0}
              prefix={<StopOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="调用趋势（近7天）" className="stat-card">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="success" name="成功" stroke="#52c41a" strokeWidth={2} />
                <Line type="monotone" dataKey="pending_review" name="待复核" stroke="#faad14" strokeWidth={2} />
                <Line type="monotone" dataKey="blocked" name="已拦截" stroke="#ff4d4f" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="最近调用记录" className="stat-card">
            <Table
              columns={columns}
              dataSource={recentCalls}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default Dashboard;
