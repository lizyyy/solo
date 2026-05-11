import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Space, Typography, Spin } from 'antd';
import {
  CalendarOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { activityApi, registrationApi } from '../services/api';
import { REGISTRATION_STATUS, getRegistrationStatusLabel } from '../utils/constants';

const { Title } = Typography;

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [activityStats, setActivityStats] = useState(null);
  const [registrationStats, setRegistrationStats] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [activityRes, registrationRes, activitiesRes] = await Promise.all([
        activityApi.statistics(),
        registrationApi.statistics(),
        activityApi.list({ limit: 5 })
      ]);

      setActivityStats(activityRes.data.data);
      setRegistrationStats(registrationRes.data.data);
      setRecentActivities(activitiesRes.data.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusOption = () => {
    if (!registrationStats?.byStatus) return {};

    const colors = {
      pending: '#faad14',
      confirmed: '#1890ff',
      rescheduled: '#722ed1',
      cancelled: '#ff4d4f',
      no_show: '#faad14',
      completed: '#52c41a'
    };

    return {
      tooltip: {
        trigger: 'item'
      },
      legend: {
        orient: 'horizontal',
        bottom: 0
      },
      series: [
        {
          name: '报名状态',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold'
            }
          },
          data: registrationStats.byStatus.map((item) => ({
            name: getRegistrationStatusLabel(item.status),
            value: item.count,
            itemStyle: { color: colors[item.status] }
          }))
        }
      ]
    };
  };

  const activityColumns = [
    {
      title: '活动名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location'
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={REGISTRATION_STATUS[status]?.color || 'default'}>
          {REGISTRATION_STATUS[status]?.label || status}
        </Tag>
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>仪表盘</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总活动数"
              value={activityStats?.total || 0}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总报名数"
              value={registrationStats?.total || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已确认"
              value={
                registrationStats?.byStatus?.find((s) => s.status === 'confirmed')?.count || 0
              }
              prefix={<CheckCircleOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已取消"
              value={
                registrationStats?.byStatus?.find((s) => s.status === 'cancelled')?.count || 0
              }
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="报名状态分布">
            <ReactECharts option={getStatusOption()} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近活动">
            <Table
              columns={activityColumns}
              dataSource={recentActivities}
              pagination={false}
              rowKey="id"
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
