import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Space, Button, message } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, WarningOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import dayjs from 'dayjs';
import { overviewApi, distributionApi } from '../services/api';
import { Statistics, PullStatus, EffectiveStatus, CompensateStatus } from '../types';

const COLORS = ['#52c41a', '#faad14', '#f5222d', '#1890ff', '#722ed1'];

function OverviewPage() {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const response = await overviewApi.getStatistics();
      setStatistics(response.data.data);
    } catch (error) {
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  const pullChartData = statistics
    ? [
        { name: '成功', value: statistics.pull.success, color: '#52c41a' },
        { name: '失败', value: statistics.pull.failed, color: '#f5222d' },
        { name: '待处理', value: statistics.pull.pending, color: '#faad14' },
        { name: '超时', value: statistics.pull.timeout, color: '#eb2f96' },
      ]
    : [];

  const effectiveChartData = statistics
    ? [
        { name: '已生效', value: statistics.effective.effective, color: '#52c41a' },
        { name: '未生效', value: statistics.effective.notEffective, color: '#f5222d' },
        { name: '部分生效', value: statistics.effective.partial, color: '#faad14' },
        { name: '未知', value: statistics.effective.unknown, color: '#d9d9d9' },
      ]
    : [];

  const compensateChartData = statistics
    ? [
        { name: '已完成', value: statistics.compensate.completed, color: '#52c41a' },
        { name: '待补偿', value: statistics.compensate.pending, color: '#faad14' },
        { name: '补偿中', value: statistics.compensate.inProgress, color: '#1890ff' },
        { name: '无需补偿', value: statistics.compensate.notNeeded, color: '#d9d9d9' },
        { name: '补偿失败', value: statistics.compensate.failed, color: '#f5222d' },
      ]
    : [];

  const recentVersionsColumns = [
    { title: '配置ID', dataIndex: 'configId', key: 'configId' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '发布者', dataIndex: 'releasedBy', key: 'releasedBy' },
    { title: '发布说明', dataIndex: 'releaseNote', key: 'releaseNote' },
    { title: '发布时间', dataIndex: 'releasedAt', key: 'releasedAt', render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss') },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>总览</h2>
        <Button icon={<ReloadOutlined />} onClick={loadStatistics} loading={loading}>
          刷新
        </Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic title="配置总数" value={statistics?.config.total || 0} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic title="已发布配置" value={statistics?.config.published || 0} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic title="服务实例" value={statistics?.instance.total || 0} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic title="旧值检测" value={statistics?.oldValueCount || 0} valueStyle={{ color: '#f5222d' }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={8}>
          <Card title="拉取状态分布" bordered={false}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pullChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value">
                  {pullChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="生效状态分布" bordered={false}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={effectiveChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value">
                  {effectiveChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="补偿状态分布" bordered={false}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={compensateChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value">
                  {compensateChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card title="最近发布版本" bordered={false} style={{ marginTop: 16 }}>
        <Table
          dataSource={statistics?.recentVersions}
          columns={recentVersionsColumns}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
}

export default OverviewPage;
