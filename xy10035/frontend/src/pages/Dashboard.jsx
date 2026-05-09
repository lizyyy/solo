import React from 'react';
import { useQuery } from 'react-query';
import { Row, Col, Card, Statistic, Table, Tag, Space } from 'antd';
import {
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { logApi } from '../services/api';

const Dashboard = () => {
  const { data: stats, isLoading } = useQuery(
    ['dashboard-stats'],
    () => logApi.getStatistics({}).then(res => res.data.data)
  );

  const logLevelColumns = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (_, record) => {
        const colors = {
          DEBUG: 'default',
          INFO: 'blue',
          WARN: 'orange',
          ERROR: 'red',
          FATAL: 'magenta'
        };
        return <Tag color={colors[record.level]}>{record.level}</Tag>;
      }
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count
    }
  ];

  const serviceColumns = [
    {
      title: '服务',
      dataIndex: '_id',
      key: '_id'
    },
    {
      title: '日志数量',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count
    }
  ];

  const errorColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '服务',
      dataIndex: 'service',
      key: 'service'
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (level) => <Tag color="red">{level}</Tag>
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true
    }
  ];

  const levelData = stats?.byLevel ? 
    Object.entries(stats.byLevel).map(([level, count]) => ({ level, count })) : [];

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总日志数"
              value={stats?.total || 0}
              prefix={<ReloadOutlined />}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功操作"
              value={stats?.byStatus?.SUCCESS || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              loading={isLoading}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="警告数"
              value={stats?.byLevel?.WARN || 0}
              prefix={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
              loading={isLoading}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="错误数"
              value={(stats?.byLevel?.ERROR || 0) + (stats?.byLevel?.FATAL || 0)}
              prefix={<StopOutlined style={{ color: '#ff4d4f' }} />}
              loading={isLoading}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={8}>
          <Card title="日志级别分布" size="small">
            <Table
              columns={logLevelColumns}
              dataSource={levelData}
              rowKey="level"
              pagination={false}
              loading={isLoading}
              size="small"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="服务日志排行" size="small">
            <Table
              columns={serviceColumns}
              dataSource={stats?.byService || []}
              rowKey="_id"
              pagination={false}
              loading={isLoading}
              size="small"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="最近错误" size="small">
            <Table
              columns={errorColumns}
              dataSource={stats?.recentErrors || []}
              rowKey="_id"
              pagination={false}
              loading={isLoading}
              size="small"
              scroll={{ x: 400 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
