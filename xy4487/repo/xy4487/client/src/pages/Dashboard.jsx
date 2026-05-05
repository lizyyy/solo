import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, message, Spin } from 'antd';
import {
  FileTextOutlined,
  CarOutlined,
  UserOutlined,
  CalendarOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { plotAPI, machineAPI, operatorAPI, reservationAPI, validationAPI } from '../utils/api';
import dayjs from 'dayjs';

function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    plots: 0,
    machines: 0,
    operators: 0,
    reservations: 0,
    blockedReservations: 0,
    allowedReservations: 0,
  });
  const [recentReservations, setRecentReservations] = useState([]);
  const [validationResult, setValidationResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plotsRes, machinesRes, operatorsRes, reservationsRes] = await Promise.all([
        plotAPI.getAll(),
        machineAPI.getAll(),
        operatorAPI.getAll(),
        reservationAPI.getAll(),
      ]);

      const machines = machinesRes.data;
      const operators = operatorsRes.data;
      const reservations = reservationsRes.data;

      const overdueMachines = machines.filter(m => m.maintenance_overdue).length;
      const expiredOperators = operators.filter(o => o.license_expired).length;
      const blockedReservations = reservations.filter(r => !r.can_proceed).length;
      const allowedReservations = reservations.filter(r => r.can_proceed).length;

      setStats({
        plots: plotsRes.data.length,
        machines: machines.length,
        operators: operators.length,
        reservations: reservations.length,
        overdueMachines,
        expiredOperators,
        blockedReservations,
        allowedReservations,
      });

      const sortedReservations = [...reservations]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);
      setRecentReservations(sortedReservations);
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const runValidation = async () => {
    setLoading(true);
    try {
      const response = await validationAPI.validateAll();
      setValidationResult(response.data);
      message.success('校验完成');
      loadData();
    } catch (error) {
      message.error('校验失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const reservationColumns = [
    {
      title: '农户',
      dataIndex: 'farmer_name',
      key: 'farmer_name',
    },
    {
      title: '地块',
      dataIndex: 'plot_name',
      key: 'plot_name',
    },
    {
      title: '机具',
      dataIndex: 'machine_name',
      key: 'machine_name',
    },
    {
      title: '机手',
      dataIndex: 'operator_name',
      key: 'operator_name',
    },
    {
      title: '作业时间',
      key: 'time',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <span>{dayjs(record.start_time).format('YYYY-MM-DD HH:mm')}</span>
          <span type="secondary">至 {dayjs(record.end_time).format('HH:mm')}</span>
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        if (record.blocked_count > 0 && !record.has_overrides) {
          return <Tag color="red">🔴 拦截</Tag>;
        } else if (record.has_overrides) {
          return <Tag color="orange">🟡 有改判</Tag>;
        }
        return <Tag color="green">🟢 正常</Tag>;
      },
    },
  ];

  return (
    <Spin spinning={loading}>
      <div className="page-header">
        <Row justify="space-between" align="middle">
          <Col>
            <h2>仪表盘</h2>
            <p>查看春耕作业派工的整体情况</p>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                刷新
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={runValidation}>
                运行校验
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {validationResult && (
        <Card className="card-margin" title="校验结果">
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="总预约数" value={validationResult.total} />
            </Col>
            <Col span={6}>
              <Statistic title="可放行" value={validationResult.allowed} valueStyle={{ color: '#52c41a' }} />
            </Col>
            <Col span={6}>
              <Statistic title="被拦截" value={validationResult.blocked} valueStyle={{ color: '#ff4d4f' }} />
            </Col>
            <Col span={6}>
              <Statistic title="问题数" value={validationResult.details.filter(d => d.total_risks > 0).length} />
            </Col>
          </Row>
        </Card>
      )}

      <Row gutter={16}>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic
              title="地块数量"
              value={stats.plots}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic
              title="机具数量"
              value={stats.machines}
              prefix={<CarOutlined style={{ color: '#52c41a' }} />}
            />
            {stats.overdueMachines > 0 && (
              <Tag color="red" style={{ marginTop: 8 }}>
                {stats.overdueMachines} 台保养逾期
              </Tag>
            )}
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic
              title="机手数量"
              value={stats.operators}
              prefix={<UserOutlined style={{ color: '#722ed1' }} />}
            />
            {stats.expiredOperators > 0 && (
              <Tag color="red" style={{ marginTop: 8 }}>
                {stats.expiredOperators} 人证照过期
              </Tag>
            )}
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic
              title="预约总数"
              value={stats.reservations}
              prefix={<CalendarOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic
              title="可放行"
              value={stats.allowedReservations}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stats-card">
            <Statistic
              title="待处理"
              value={stats.blockedReservations}
              prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="card-margin" title="最近预约" style={{ marginTop: 24 }}>
        <Table
          columns={reservationColumns}
          dataSource={recentReservations}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>
    </Spin>
  );
}

export default Dashboard;
