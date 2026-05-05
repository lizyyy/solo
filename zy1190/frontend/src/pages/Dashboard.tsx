import React, { useState, useEffect } from 'react';
import { 
  Row, Col, Card, Statistic, Button, List, Tag, Space,
  Spin, message, Empty, Typography, Progress
} from 'antd';
import { 
  ThunderboltOutlined, ClockCircleOutlined, 
  LineChartOutlined, DatabaseOutlined,
  ExperimentOutlined, PlayCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { listExperiments, getTests } from '../services/api';
import type { ExperimentListItem, TestInfo } from '../types';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState<ExperimentListItem[]>([]);
  const [tests, setTests] = useState<TestInfo[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expData, testsData] = await Promise.all([
        listExperiments(10, 0),
        getTests()
      ]);
      setExperiments(expData);
      setTests(testsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: experiments.length,
    completed: experiments.filter(e => e.has_result).length,
    recent: experiments.filter(e => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      return new Date(e.created_at) > oneDayAgo;
    }).length
  };

  const testCards = [
    {
      title: '顺序访问',
      name: 'sequential',
      color: '#52c41a',
      description: '最佳缓存利用场景，顺序读取数组元素',
      icon: <LineChartOutlined />
    },
    {
      title: '跨步访问',
      name: 'stride',
      color: '#1890ff',
      description: '跨步访问数组，观察缓存行利用率问题',
      icon: <DatabaseOutlined />
    },
    {
      title: '随机访问',
      name: 'random',
      color: '#722ed1',
      description: '随机内存访问，最差缓存性能场景',
      icon: <ThunderboltOutlined />
    },
    {
      title: '伪共享',
      name: 'false_sharing',
      color: '#fa8c16',
      description: '多线程共享缓存行导致的性能问题',
      icon: <ClockCircleOutlined />
    }
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Title level={4}>欢迎使用 Cache Lab</Title>
            <Text type="secondary">
              这是一个 CPU Cache 性能实验台，帮助你理解缓存行、Cache Miss、伪共享和 NUMA 远端内存如何影响程序性能。
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="metric-card">
            <Statistic
              title="总实验数"
              value={stats.total}
              prefix={<ExperimentOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="metric-card">
            <Statistic
              title="已完成"
              value={stats.completed}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="metric-card">
            <Statistic
              title="今日新建"
              value={stats.recent}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="metric-card">
            <Statistic
              title="可用测试"
              value={tests.length}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Title level={5}>快速开始实验</Title>
        </Col>

        {testCards.map((card) => (
          <Col xs={24} sm={12} md={6} key={card.name}>
            <Card
              hoverable
              onClick={() => navigate('/experiments/new', { state: { defaultTest: card.name } })}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, color: card.color, marginBottom: 8 }}>
                  {card.icon}
                </div>
                <Text strong>{card.title}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {card.description}
                </Text>
              </div>
            </Card>
          </Col>
        ))}

        <Col span={12}>
          <Card 
            title="最近实验" 
            extra={
              <Link to="/experiments">查看全部</Link>
            }
          >
            {experiments.length === 0 ? (
              <Empty description="暂无实验">
                <Button type="primary" onClick={() => navigate('/experiments/new')}>
                  创建第一个实验
                </Button>
              </Empty>
            ) : (
              <List
                dataSource={experiments.slice(0, 5)}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Link to={`/experiments/${item.id}`}>详情</Link>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          {item.name}
                          {item.has_result ? (
                            <Tag color="green">已完成</Tag>
                          ) : (
                            <Tag color="orange">待运行</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Text type="secondary">
                          {item.test_name} · {new Date(item.created_at).toLocaleString()}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="学习指南">
            <List
              dataSource={[
                {
                  title: '什么是缓存行？',
                  desc: 'CPU 缓存的基本传输单位，通常为 64 字节',
                  link: '/experiments/new',
                  defaultTest: 'sequential'
                },
                {
                  title: '为什么跨步访问更慢？',
                  desc: '大跨步导致每次访问都需要加载新的缓存行',
                  link: '/experiments/new',
                  defaultTest: 'stride'
                },
                {
                  title: '什么是伪共享？',
                  desc: '多线程修改同一缓存行的不同变量，导致缓存一致性开销',
                  link: '/experiments/new',
                  defaultTest: 'false_sharing'
                }
              ]}
              renderItem={(item) => (
                <List.Item
                  onClick={() => navigate(item.link, { state: { defaultTest: item.defaultTest } })}
                  style={{ cursor: 'pointer' }}
                >
                  <List.Item.Meta
                    title={<Text strong>{item.title}</Text>}
                    description={
                      <Text type="secondary">{item.desc}</Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
