import React, { useEffect, useState } from 'react';
import {
  Row, Col, Card, Statistic, List, Tag, Space, Button, Table, Alert,
  RefreshOutlined, WarningOutlined, CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined
} from 'antd';
import { dashboardApi, alertApi, deathLossApi } from '../services/api';
import dayjs from 'dayjs';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [deathLosses, setDeathLosses] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, alertsRes, deathRes] = await Promise.all([
        dashboardApi.getOverview(),
        alertApi.getAll({ status: 'active' }),
        deathLossApi.getAll()
      ]);
      setData(dashboardRes.data.data);
      setAlerts(alertsRes.data.data);
      setDeathLosses(deathRes.data.data);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    const colors = {
      normal: 'success',
      warning: 'warning',
      alert: 'error',
      offline: 'default'
    };
    return colors[status] || 'default';
  };

  const getBottleneckIcon = (type) => {
    const icons = {
      critical: <WarningOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />,
      warning: <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 24 }} />,
      danger: <WarningOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />,
      normal: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />
    };
    return icons[type] || <InfoCircleOutlined />;
  };

  const getBottleneckColor = (type) => {
    const colors = {
      critical: 'error',
      warning: 'warning',
      danger: 'error',
      normal: 'success'
    };
    return colors[type] || 'info';
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await alertApi.acknowledge(alertId);
      fetchData();
    } catch (error) {
      console.error('确认报警失败:', error);
    }
  };

  const handleAnalyze = async (lossId) => {
    try {
      await deathLossApi.analyze(lossId);
      fetchData();
    } catch (error) {
      console.error('分析失败:', error);
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!data) {
    return <div>暂无数据</div>;
  }

  const tankColumns = [
    { title: '暂养池', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>
    },
    {
      title: '温度',
      dataIndex: 'current_temperature',
      key: 'temperature',
      render: (v) => v ? `${v}°C` : '-'
    },
    {
      title: '盐度',
      dataIndex: 'current_salinity',
      key: 'salinity',
      render: (v) => v ? `${v}‰` : '-'
    },
    {
      title: '溶氧',
      dataIndex: 'current_oxygen',
      key: 'oxygen',
      render: (v) => v ? `${v}mg/L` : '-'
    },
    {
      title: '最后检测',
      dataIndex: 'last_check_time',
      key: 'last_check',
      render: (t) => t ? dayjs(t).format('MM-DD HH:mm') : '-'
    }
  ];

  const alertColumns = [
    { title: '类型', dataIndex: 'alert_type', key: 'type' },
    { title: '暂养池', dataIndex: 'tank_name', key: 'tank' },
    { title: '消息', dataIndex: 'message', key: 'message' },
    {
      title: '阈值',
      key: 'threshold',
      render: (_, record) => `${record.threshold_value}`
    },
    {
      title: '实际值',
      key: 'actual',
      render: (_, record) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{record.actual_value}</span>
      )
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'time',
      render: (t) => dayjs(t).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button size="small" onClick={() => handleAcknowledge(record.id)}>确认</Button>
      )
    }
  ];

  const deathColumns = [
    { title: '批次', dataIndex: 'batch_number', key: 'batch' },
    { title: '品种', dataIndex: 'species', key: 'species' },
    { title: '暂养池', dataIndex: 'tank_name', key: 'tank' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    {
      title: '状态',
      dataIndex: 'attribution_status',
      key: 'status',
      render: (status) => {
        const colors = {
          pending: 'default',
          analyzing: 'processing',
          completed: 'success',
          disputed: 'warning'
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '发现时间',
      dataIndex: 'discovered_at',
      key: 'time',
      render: (t) => dayjs(t).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        if (record.attribution_status === 'pending') {
          return (
            <Button size="small" type="primary" onClick={() => handleAnalyze(record.id)}>
              分析
            </Button>
          );
        }
        return null;
      }
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>系统概览</h2>
        <Button icon={<RefreshOutlined />} onClick={fetchData}>刷新</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="暂养池总数"
              value={data.stats.tanks.total}
              suffix="个"
              valueStyle={{ color: '#1890ff' }}
            />
            <Space size="small" style={{ marginTop: 8 }}>
              <Tag color="success">正常 {data.stats.tanks.normal}</Tag>
              <Tag color="warning">警告 {data.stats.tanks.warning}</Tag>
              <Tag color="error">异常 {data.stats.tanks.alert}</Tag>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃批次"
              value={data.stats.batches.active}
              suffix="批"
              valueStyle={{ color: '#13c2c2' }}
            />
            <Space size="small" style={{ marginTop: 8 }}>
              <Tag color="blue">待入库 {data.stats.batches.pending}</Tag>
              <Tag color="success">已完成 {data.stats.batches.completed}</Tag>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未处理报警"
              value={data.stats.alerts.total}
              suffix="条"
              valueStyle={{ color: data.stats.alerts.total > 0 ? '#ff4d4f' : '#52c41a' }}
            />
            <Space size="small" style={{ marginTop: 8 }}>
              <Tag>温度 {data.stats.alerts.temperature}</Tag>
              <Tag>盐度 {data.stats.alerts.salinity}</Tag>
              <Tag>溶氧 {data.stats.alerts.oxygen}</Tag>
            </Space>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待归因死耗"
              value={data.stats.deathLoss.pending + data.stats.deathLoss.analyzing}
              suffix="条"
              valueStyle={{ color: '#faad14' }}
            />
            <Space size="small" style={{ marginTop: 8 }}>
              <Tag color="default">待处理 {data.stats.deathLoss.pending}</Tag>
              <Tag color="processing">分析中 {data.stats.deathLoss.analyzing}</Tag>
              <Tag color="success">已完成 {data.stats.deathLoss.completed}</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="当前卡点" size="small">
            {data.bottlenecks && data.bottlenecks.length > 0 ? (
              <List
                dataSource={data.bottlenecks}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={getBottleneckIcon(item.type)}
                      title={
                        <Space>
                          <Tag color={getBottleneckColor(item.type)}>{item.title}</Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <p>{item.description}</p>
                          <Alert
                            message={item.action}
                            type="info"
                            showIcon
                            style={{ marginTop: 8 }}
                          />
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                暂无卡点信息
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="处理建议" size="small">
            {data.recommendations && data.recommendations.length > 0 ? (
              <List
                dataSource={data.recommendations}
                renderItem={(item, index) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color={item.priority === 'high' ? 'red' : item.priority === 'medium' ? 'orange' : 'blue'}>
                            {item.priority}
                          </Tag>
                          <strong>{item.title}</strong>
                        </Space>
                      }
                      description={item.description}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                暂无建议
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="暂养池状态" size="small">
            <Table
              dataSource={data.tanks || []}
              columns={tankColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {alerts.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card
              title={
                <Space>
                  <WarningOutlined style={{ color: '#ff4d4f' }} />
                  <span>未处理报警 ({alerts.length})</span>
                </Space>
              }
              size="small"
            >
              <Table
                dataSource={alerts}
                columns={alertColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      )}

      {deathLosses.filter(d => d.attribution_status !== 'completed').length > 0 && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card
              title={
                <Space>
                  <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                  <span>待归因死耗</span>
                </Space>
              }
              size="small"
            >
              <Table
                dataSource={deathLosses.filter(d => d.attribution_status !== 'completed')}
                columns={deathColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}

export default Dashboard;
