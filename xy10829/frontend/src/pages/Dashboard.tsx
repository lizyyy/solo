import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Button, Space, Table, Tag, Progress, message } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  ExportOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getStatistics, getTimeoutEvents, exportEvents } from '../api';
import { EventStatus, TimeoutEvent } from '../types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState({ total: 0, success: 0, failed: 0, pending: 0, today: 0 });
  const [recentEvents, setRecentEvents] = useState<TimeoutEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stats, eventsResult] = await Promise.all([
        getStatistics(),
        getTimeoutEvents({ page: 1, pageSize: 10 })
      ]);
      setStatistics(stats);
      setRecentEvents(eventsResult.events);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStatusTag = (status: EventStatus) => {
    const statusMap: Record<EventStatus, { color: string; text: string }> = {
      [EventStatus.SUCCESS]: { color: 'success', text: '成功' },
      [EventStatus.FAILED]: { color: 'error', text: '失败' },
      [EventStatus.PENDING]: { color: 'default', text: '待处理' },
      [EventStatus.PROCESSING]: { color: 'processing', text: '处理中' },
      [EventStatus.RETRYING]: { color: 'warning', text: '重试中' },
      [EventStatus.CANCELLED]: { color: 'default', text: '已取消' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '事件ID',
      dataIndex: 'eventKey',
      key: 'eventKey',
      width: 200,
      ellipsis: true
    },
    {
      title: '工单ID',
      dataIndex: 'ticketId',
      key: 'ticketId',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: EventStatus) => getStatusTag(status)
    },
    {
      title: '重试次数',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 100,
      render: (count: number, record: TimeoutEvent) => `${count}/${record.maxRetries}`
    },
    {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      key: 'triggeredAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: TimeoutEvent) => (
        <Button type="link" size="small" onClick={() => navigate(`/events/${record.id}`)}>
          详情
        </Button>
      )
    }
  ];

  const successRate = statistics.total > 0 ? Math.round((statistics.success / statistics.total) * 100) : 0;

  return (
    <div>
      <Space style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>数据总览</h2>
        <Button icon={<ExportOutlined />} onClick={() => exportEvents()}>
          导出数据
        </Button>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" onClick={() => navigate('/events')}>
            <Statistic
              title="事件总数"
              value={statistics.total}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" onClick={() => navigate('/events?status=success')}>
            <Statistic
              title="成功"
              value={statistics.success}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" onClick={() => navigate('/events?status=failed')}>
            <Statistic
              title="失败"
              value={statistics.failed}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" onClick={() => navigate('/events?status=pending')}>
            <Statistic
              title="待处理"
              value={statistics.pending}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="今日事件">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>今日新增: {statistics.today} 条</div>
              <Progress percent={successRate} status={successRate < 80 ? 'exception' : 'active'} format={() => `成功率: ${successRate}%`} />
            </Space>
          </Card>
        </Col>
      </Row>

      <Card 
        title="最近事件" 
        extra={<Button icon={<SyncOutlined />} onClick={loadData} loading={loading}>刷新</Button>}
      >
        <Table
          columns={columns}
          dataSource={recentEvents}
          rowKey="id"
          pagination={false}
          loading={loading}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
