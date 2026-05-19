import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Progress, Button } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { batches, collections } from '../services/api';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    running: 0,
    successRate: 0,
  });
  const [recentBatches, setRecentBatches] = useState([]);
  const [collectionList, setCollectionList] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [batchesRes, collectionsRes] = await Promise.all([
        batches.getAll(),
        collections.getAll(),
      ]);

      const allBatches = batchesRes.data;
      const completed = allBatches.filter(b => b.status === 'completed').length;
      const failed = allBatches.filter(b => b.status === 'failed').length;
      const running = allBatches.filter(b => b.status === 'running').length;

      setStats({
        total: allBatches.length,
        completed,
        failed,
        running,
        successRate: allBatches.length > 0 ? Math.round((completed / allBatches.length) * 100) : 0,
      });

      setRecentBatches(allBatches.slice(0, 10));
      setCollectionList(collectionsRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      completed: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
      running: { color: 'processing', icon: <SyncOutlined spin />, text: '执行中' },
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: '待执行' },
    };
    const cfg = statusMap[status] || statusMap.pending;
    return <Tag icon={cfg.icon} color={cfg.color}>{cfg.text}</Tag>;
  };

  const batchColumns = [
    {
      title: '执行批次',
      dataIndex: 'collection_name',
      key: 'collection_name',
      render: (text, record) => (
        <a onClick={() => navigate(`/batches/${record.id}`)}>
          {text || record.id.substring(0, 8)}
        </a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '步骤进度',
      key: 'progress',
      render: (_, record) => (
        <Progress
          percent={record.total_steps > 0 ? Math.round((record.passed_steps / record.total_steps) * 100) : 0}
          size="small"
          status={record.status === 'failed' ? 'exception' : 'normal'}
        />
      ),
    },
    {
      title: '成功/失败',
      key: 'steps',
      render: (_, record) => (
        <span>
          <Tag color="success">{record.passed_steps}</Tag>
          <Tag color="error">{record.failed_steps}</Tag>
        </span>
      ),
    },
    {
      title: '执行时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  const collectionColumns = [
    {
      title: '集合名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/collections/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '步骤数',
      dataIndex: 'step_count',
      key: 'step_count',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<PlayCircleOutlined />}
          onClick={() => navigate(`/collections/${record.id}`)}
        >
          执行
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>总览</h2>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总执行次数"
              value={stats.total}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功"
              value={stats.completed}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败"
              value={stats.failed}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功率"
              value={stats.successRate}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="最近执行记录" extra={<Button onClick={loadData}>刷新</Button>}>
            <Table
              columns={batchColumns}
              dataSource={recentBatches}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="巡检集合">
            <Table
              columns={collectionColumns}
              dataSource={collectionList}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
