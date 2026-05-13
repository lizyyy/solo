import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Space } from 'antd';
import { UserOutlined, WarningOutlined, ClockCircleOutlined, DollarOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalChildren: 0,
    pendingExceptions: 0,
    todayLate: 0,
    totalLateFee: 0
  });
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, exceptionsRes] = await Promise.all([
        axios.get('/api/dashboard/stats'),
        axios.get('/api/pickup-exceptions', { params: { status: 'pending' } })
      ]);
      setStats(statsRes.data);
      setExceptions(exceptionsRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
    setLoading(false);
  };

  const exceptionColumns = [
    {
      title: '儿童姓名',
      dataIndex: 'child_name',
      key: 'child_name',
    },
    {
      title: '班级',
      dataIndex: 'class_name',
      key: 'class_name',
    },
    {
      title: '异常类型',
      dataIndex: 'exception_type',
      key: 'exception_type',
      render: (type) => {
        const typeMap = {
          'late_pickup': '迟接',
          'unauthorized': '未授权',
          'missing': '未签到'
        };
        return typeMap[type] || type;
      }
    },
    {
      title: '异常级别',
      dataIndex: 'exception_level',
      key: 'exception_level',
      render: (level) => {
        const colorMap = {
          'warning': 'orange',
          'danger': 'red',
          'info': 'blue'
        };
        return <Tag color={colorMap[level]}>{level === 'warning' ? '警告' : level === 'danger' ? '严重' : '提示'}</Tag>;
      }
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '接送日期',
      dataIndex: 'pickup_date',
      key: 'pickup_date',
      render: (date) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          'pending': { color: 'orange', text: '待处理' },
          'processing': { color: 'blue', text: '处理中' },
          'resolved': { color: 'green', text: '已解决' }
        };
        const s = statusMap[status] || statusMap['pending'];
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate('/exceptions')}
        >
          处理
        </Button>
      )
    }
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="在园儿童总数"
              value={stats.totalChildren}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="待处理异常"
              value={stats.pendingExceptions}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="今日迟接数"
              value={stats.todayLate}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stats-card">
            <Statistic
              title="累计迟接费用"
              value={stats.totalLateFee}
              prefix={<DollarOutlined />}
              suffix="元"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="待处理异常列表" extra={
        <Button type="primary" onClick={() => navigate('/exceptions')}>
          查看全部
        </Button>
      }>
        <Table
          columns={exceptionColumns}
          dataSource={exceptions}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
