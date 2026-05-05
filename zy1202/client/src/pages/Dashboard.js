import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Tag, 
  Button,
  Empty,
  Spin,
  message
} from 'antd';
import { 
  ExperimentOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined,
  PlusOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    running: 0,
    created: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadExperiments();
  }, []);

  const loadExperiments = async () => {
    try {
      setLoading(true);
      const response = await api.experiments.getAll();
      if (response.success) {
        const exps = response.data || [];
        setExperiments(exps);
        
        const total = exps.length;
        const completed = exps.filter(e => e.status === 'completed').length;
        const running = exps.filter(e => e.status === 'running').length;
        const created = exps.filter(e => e.status === 'created').length;
        
        setStats({ total, completed, running, created });
      }
    } catch (error) {
      message.error('加载实验列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status) => {
    switch (status) {
      case 'completed':
        return <Tag color="green">已完成</Tag>;
      case 'running':
        return <Tag color="blue">运行中</Tag>;
      case 'created':
        return <Tag color="orange">已创建</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: '实验名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/experiments/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag
    },
    {
      title: '缓存策略',
      dataIndex: ['config', 'strategy'],
      key: 'strategy'
    },
    {
      title: '写入策略',
      dataIndex: ['config', 'writeStrategy'],
      key: 'writeStrategy'
    },
    {
      title: '流量步骤',
      dataIndex: 'trafficPlanCount',
      key: 'trafficPlanCount'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => navigate(`/experiments/${record.id}`)}
        >
          查看
        </Button>
      )
    }
  ];

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总实验数"
              value={stats.total}
              prefix={<ExperimentOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中"
              value={stats.running}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待运行"
              value={stats.created}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ExperimentOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card 
        style={{ marginTop: 24 }}
        title="最近实验"
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => navigate('/experiments/create')}
          >
            创建新实验
          </Button>
        }
      >
        {experiments.length > 0 ? (
          <Table 
            columns={columns} 
            dataSource={experiments} 
            rowKey="id"
            pagination={{ pageSize: 5 }}
          />
        ) : (
          <Empty 
            description="暂无实验，点击上方按钮创建第一个实验"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      <Card style={{ marginTop: 24 }} title="功能介绍">
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card size="small" title="缓存策略配置">
              <p>支持多种缓存策略：</p>
              <ul>
                <li>Cache-Aside 模式</li>
                <li>Write-Through 模式</li>
                <li>Write-Behind 模式</li>
                <li>延迟双删策略</li>
              </ul>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" title="风险防护">
              <p>内置多种防护机制：</p>
              <ul>
                <li>布隆过滤器（防穿透）</li>
                <li>互斥锁（防击穿）</li>
                <li>TTL 抖动（防雪崩）</li>
                <li>缓存预热</li>
              </ul>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" title="指标分析">
              <p>全面的性能指标：</p>
              <ul>
                <li>缓存命中率</li>
                <li>回源次数统计</li>
                <li>一致性窗口分析</li>
                <li>风险时间线</li>
              </ul>
            </Card>
          </Col>
        </Row>
      </Card>
    </Spin>
  );
};

export default Dashboard;
