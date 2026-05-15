import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Space, Button, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, ReloadOutlined, FileTextOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

function Dashboard() {
  const [stats, setStats] = useState({});
  const [recentHistory, setRecentHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/history/statistics');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (error) {
      message.error('获取统计数据失败');
    }
  };

  const fetchRecentHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/history', { params: { limit: 10 } });
      if (res.data.success) {
        setRecentHistory(res.data.data);
      }
    } catch (error) {
      message.error('获取历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchRecentHistory();
  }, []);

  const statusColors = {
    success: 'green',
    failed: 'red',
    no_match: 'orange',
    compensated: 'blue'
  };

  const statusLabels = {
    success: '成功',
    failed: '失败',
    no_match: '无匹配',
    compensated: '已补偿'
  };

  const columns = [
    {
      title: '请求路径',
      dataIndex: 'requestPath',
      key: 'requestPath',
      ellipsis: true,
      width: 200
    },
    {
      title: '方法',
      dataIndex: 'requestMethod',
      key: 'requestMethod',
      width: 80,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      )
    },
    {
      title: 'HTTP 状态码',
      dataIndex: 'responseStatusCode',
      key: 'responseStatusCode',
      width: 120
    },
    {
      title: '匹配场景',
      dataIndex: 'matchedSceneName',
      key: 'matchedSceneName',
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '延迟(ms)',
      dataIndex: 'responseDelay',
      key: 'responseDelay',
      width: 100
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchStats(); fetchRecentHistory(); }}>
          刷新数据
        </Button>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总请求数"
              value={stats.total || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功请求"
              value={stats.success || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败请求"
              value={stats.failed || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均响应延迟(ms)"
              value={stats.averageDelay || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近回放记录" extra={<Tag color="blue">最近 10 条</Tag>}>
        <Table
          columns={columns}
          dataSource={recentHistory}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
}

export default Dashboard;
