import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Statistic, Card, Table, Button, DatePicker, 
  Typography, Space, message
} from 'antd';
import { 
  UserOutlined, 
  GiftOutlined, 
  WarningOutlined, 
  MessageOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const { Title } = Typography;

const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [monthlyReport, setMonthlyReport] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchMonthlyReport();
  }, [selectedMonth]);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/dashboard/stats');
      setStats(res.data);
    } catch (error) {
      message.error('获取统计数据失败');
    }
  };

  const fetchMonthlyReport = async () => {
    setLoading(true);
    try {
      const year = selectedMonth.year();
      const month = selectedMonth.month() + 1;
      const res = await axios.get(`/api/dashboard/monthly-report/${year}/${month}`);
      setMonthlyReport(res.data);
    } catch (error) {
      message.error('获取月度报表失败');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    try {
      const year = selectedMonth.year();
      const month = selectedMonth.month() + 1;
      const response = await axios.get(`/api/dashboard/monthly-report/${year}/${month}/export`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${year}年${month}月积分表.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const topResidentsColumns = [
    { title: '居民姓名', dataIndex: 'name', key: 'name' },
    { title: '联系电话', dataIndex: 'phone', key: 'phone' },
    { title: '当前积分', dataIndex: 'total_points', key: 'total_points', sorter: (a, b) => a.total_points - b.total_points },
  ];

  const reportColumns = [
    { title: '居民姓名', dataIndex: 'resident_name', key: 'resident_name' },
    { title: '联系电话', dataIndex: 'phone', key: 'phone' },
    { title: '获得积分', dataIndex: 'earned_points', key: 'earned_points' },
    { title: '扣除积分', dataIndex: 'deducted_points', key: 'deducted_points' },
    { title: '兑换积分', dataIndex: 'exchanged_points', key: 'exchanged_points' },
    { title: '返还积分', dataIndex: 'refund_points', key: 'refund_points' },
    { title: '申诉返还', dataIndex: 'complaint_return_points', key: 'complaint_return_points' },
    { title: '当前积分', dataIndex: 'current_total', key: 'current_total' },
  ];

  const chartData = stats.weeklyTrend?.map(item => ({
    name: item.garbage_type,
    投递次数: item.count,
    重量: item.total_weight
  })) || [];

  return (
    <div>
      <Title level={2}>数据看板</Title>
      
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="居民总数"
              value={stats.totalResidents || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总积分"
              value={stats.totalPoints || 0}
              prefix={<GiftOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核兑换"
              value={stats.pendingExchanges || 0}
              prefix={<GiftOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日抽检异常"
              value={stats.todayUnqualified || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="积分排行榜（前10名）">
            <Table
              columns={topResidentsColumns}
              dataSource={stats.topResidents || []}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="近7天投递趋势">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="投递次数" fill="#8884d8" />
                <Bar yAxisId="right" dataKey="重量" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card 
        title="月度积分报表" 
        extra={
          <Space>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={setSelectedMonth}
              format="YYYY年MM月"
            />
            <Button type="primary" icon={<DownloadOutlined />} onClick={exportReport}>
              导出Excel
            </Button>
          </Space>
        }
      >
        <Table
          columns={reportColumns}
          dataSource={monthlyReport}
          rowKey="resident_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
