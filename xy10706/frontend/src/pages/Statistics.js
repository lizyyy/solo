import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Select, DatePicker, Spin, message } from 'antd';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { quotaApi } from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const COLORS = ['#52c41a', '#faad14', '#ff4d4f', '#1890ff'];

const Statistics = () => {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({});
  const [trendData, setTrendData] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  useEffect(() => {
    fetchCustomers();
    fetchStatistics();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await quotaApi.getCustomers();
      setCustomers(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCustomer) params.customerId = selectedCustomer;
      if (dateRange && dateRange[0]) {
        params.startDate = dateRange[0].toISOString();
      }
      if (dateRange && dateRange[1]) {
        params.endDate = dateRange[1].toISOString();
      }

      const [statsRes, trendRes] = await Promise.all([
        quotaApi.getStatistics(params),
        quotaApi.getDailyTrend({ days: 30, ...params }),
      ]);

      setStatistics(statsRes.data);

      const formattedTrend = formatTrendData(trendRes.data.trend || []);
      setTrendData(formattedTrend);
    } catch (error) {
      message.error('获取统计数据失败');
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

  const pieData = [
    { name: '成功', value: statistics.successCalls || 0 },
    { name: '待复核', value: statistics.pendingCalls || 0 },
    { name: '已拦截', value: statistics.blockedCalls || 0 },
    { name: '可重试', value: statistics.retryableCalls || 0 },
  ].filter(item => item.value > 0);

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Select
            style={{ width: '100%' }}
            placeholder="选择客户（可选）"
            allowClear
            onChange={setCustomer}
          >
            {customers.map(c => (
              <Option key={c.id} value={c.id}>{c.name}</Option>
            ))}
          </Select>
        </Col>
        <Col span={12}>
          <RangePicker
            style={{ width: '100%' }}
            value={dateRange}
            onChange={setDateRange}
            onOk={fetchStatistics}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="总调用次数"
              value={statistics.totalCalls || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="成功调用"
              value={statistics.successCalls || 0}
              valueStyle={{ color: '#52c41a' }}
              suffix={<span style={{ fontSize: 14 }}>({statistics.successRate || 0}%)</span>}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="总配额消耗"
              value={statistics.totalCost || 0}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="待处理重试"
              value={statistics.retryableCalls || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="调用状态分布" className="stat-card">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="每日调用趋势（近30天）" className="stat-card">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="success" name="成功" fill="#52c41a" />
                <Bar dataKey="pending_review" name="待复核" fill="#faad14" />
                <Bar dataKey="blocked" name="已拦截" fill="#ff4d4f" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </Spin>
  );
};

export default Statistics;
