import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Progress, Space, Button, Alert } from 'antd';
import {
  BankOutlined,
  TeamOutlined,
  FileTextOutlined,
  SettingOutlined,
  WarningOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { dashboardAPI, analyticsAPI, adjustmentsAPI } from '../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [heatData, setHeatData] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, heatResult, tasksResult, warningsResult] = await Promise.all([
        dashboardAPI.getStats(),
        analyticsAPI.getStationHeat(),
        adjustmentsAPI.getAll({ status: 'pending' }),
        analyticsAPI.getWarnings(),
      ]);
      setStats(statsData);
      setHeatData(heatResult);
      setPendingTasks(tasksResult.slice(0, 5));
      setWarnings(warningsResult);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getHeatColor = (score) => {
    if (score >= 70) return 'success';
    if (score >= 40) return 'warning';
    return 'exception';
  };

  const getHeatText = (score) => {
    if (score >= 70) return '高热度';
    if (score >= 40) return '中热度';
    return '低热度';
  };

  const heatColumns = [
    {
      title: '站点',
      dataIndex: 'station_name',
      key: 'station_name',
    },
    {
      title: '线路',
      dataIndex: 'route_name',
      key: 'route_name',
    },
    {
      title: '报名人数',
      dataIndex: 'registration_count',
      key: 'registration_count',
      width: 100,
    },
    {
      title: '实际乘车',
      dataIndex: 'actual_count',
      key: 'actual_count',
      width: 100,
    },
    {
      title: '差异率',
      dataIndex: 'difference_rate',
      key: 'difference_rate',
      width: 120,
      render: (rate) => <span style={{ color: rate >= 0.5 ? '#ff4d4f' : '#52c41a' }}>{(rate * 100).toFixed(1)}%</span>,
    },
    {
      title: '热度指数',
      key: 'heat',
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Progress
            percent={Math.round(record.heat_score)}
            status={getHeatColor(record.heat_score)}
            size="small"
          />
          <Tag color={getHeatColor(record.heat_score)} style={{ marginTop: -8 }}>
            {getHeatText(record.heat_score)}
          </Tag>
        </Space>
      ),
    },
  ];

  const taskColumns = [
    { title: '任务标题', dataIndex: 'title', key: 'title' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => type === 'withdrawal' ? <Tag color="red">撤点</Tag> : <Tag>调整</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          pending: { color: 'blue', text: '待处理' },
          pending_review: { color: 'orange', text: '待复核' },
          approved: { color: 'green', text: '已通过' },
          rejected: { color: 'red', text: '已拒绝' },
        };
        const s = statusMap[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>数据总览</h2>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新数据</Button>
      </div>

      {warnings.length > 0 && (
        <Alert
          message={`有 ${warnings.length} 个站点需要关注，差异率超过50%`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 24 }}
          action={
            <Button size="small" type="primary" href="#/analytics">
              查看分析
            </Button>
          }
        />
      )}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="运营站点"
              value={stats.activeStations || 0}
              prefix={<BankOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="员工总数"
              value={stats.totalEmployees || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="活跃报名"
              value={stats.activeRegistrations || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="待处理任务"
              value={stats.pendingAdjustments || 0}
              prefix={<SettingOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="站点热度排行" extra={<span style={{ color: '#999' }}>热度越低越建议调整</span>}>
            <Table
              columns={heatColumns}
              dataSource={heatData}
              rowKey="station_id"
              pagination={{ pageSize: 5 }}
              size="middle"
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="最近调整任务">
            <Table
              columns={taskColumns}
              dataSource={pendingTasks}
              rowKey="id"
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
