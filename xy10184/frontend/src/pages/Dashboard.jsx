import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Table, Tag, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { appealApi } from '../api';
import { useAuth } from '../context/AuthContext';

const { Title } = Typography;

const STATUS_COLORS = {
  pending: 'default',
  processing: 'blue',
  reviewing: 'orange',
  completed: 'green',
  rejected: 'red'
};

const STATUS_NAMES = {
  pending: '待处理',
  processing: '处理中',
  reviewing: '待复核',
  completed: '已通过',
  rejected: '已驳回'
};

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [recentAppeals, setRecentAppeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  useEffect(() => {
    loadStats();
    loadRecentAppeals();
  }, []);

  const loadStats = async () => {
    try {
      const { data } = await appealApi.getStats();
      setStats(data);
    } catch (err) {
      console.error('加载统计数据失败', err);
    }
  };

  const loadRecentAppeals = async () => {
    setLoading(true);
    try {
      const { data } = await appealApi.getList({ page: 1, pageSize: 10 });
      setRecentAppeals(data.list);
    } catch (err) {
      console.error('加载最近申诉失败', err);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '申诉编号',
      dataIndex: 'appeal_no',
      key: 'appeal_no',
      render: (text) => <span style={{ fontFamily: 'monospace' }}>{text}</span>
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={STATUS_COLORS[status]}>
          {STATUS_NAMES[status]}
        </Tag>
      )
    },
    {
      title: '操作员',
      dataIndex: 'operator_name',
      key: 'operator_name',
      render: (name) => name || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => new Date(time).toLocaleString('zh-CN')
    }
  ];

  return (
    <div>
      <Title level={3}>工作台概览</Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic 
              title="总申诉数" 
              value={stats.total || 0} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic 
              title="待处理" 
              value={stats.pending || 0} 
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic 
              title="处理中" 
              value={stats.processing || 0} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic 
              title="待复核" 
              value={stats.reviewing || 0} 
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic 
              title="已通过" 
              value={stats.completed || 0} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic 
              title="已驳回" 
              value={stats.rejected || 0} 
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card 
        title="最近申诉" 
        extra={
          <Button type="link" onClick={() => navigate('/appeals')}>
            查看全部
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={recentAppeals}
          rowKey="id"
          loading={loading}
          pagination={false}
          onRow={(record) => ({
            onClick: () => navigate(`/appeals/${record.id}`),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>
    </div>
  );
}
