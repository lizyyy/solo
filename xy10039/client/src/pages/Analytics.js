import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Statistic,
  Typography,
  Spin,
  Tag,
  Space
} from 'antd';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import {
  registrationApi,
  activityApi
} from '../services/api';
import {
  getRegistrationStatusLabel
} from '../utils/constants';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [registrationStats, setRegistrationStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadRegistrationStats();
  }, [selectedActivity]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [activitiesRes] = await Promise.all([
        activityApi.list({ limit: 100 })
      ]);
      setActivities(activitiesRes.data.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrationStats = async () => {
    try {
      const res = await registrationApi.statistics(selectedActivity);
      setRegistrationStats(res.data.data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  const getStatusPieOption = () => {
    if (!registrationStats?.byStatus) return {};

    const colors = {
      pending: '#faad14',
      confirmed: '#1890ff',
      rescheduled: '#722ed1',
      cancelled: '#ff4d4f',
      no_show: '#fa8c16',
      completed: '#52c41a'
    };

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'center'
      },
      series: [
        {
          name: '报名状态',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['60%', '50%'],
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
              fontSize: 16,
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

  const getStatusBarOption = () => {
    if (!registrationStats?.byStatus) return {};

    const colors = {
      pending: '#faad14',
      confirmed: '#1890ff',
      rescheduled: '#722ed1',
      cancelled: '#ff4d4f',
      no_show: '#fa8c16',
      completed: '#52c41a'
    };

    const sortedStatuses = [...registrationStats.byStatus].sort(
      (a, b) => b.count - a.count
    );

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: sortedStatuses.map((item) =>
          getRegistrationStatusLabel(item.status)
        ),
        axisLabel: {
          interval: 0,
          rotate: 30
        }
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '人数',
          type: 'bar',
          data: sortedStatuses.map((item) => ({
            value: item.count,
            itemStyle: {
              color: colors[item.status]
            }
          })),
          barWidth: '50%',
          label: {
            show: true,
            position: 'top'
          }
        }
      ]
    };
  };

  const getConversionOption = () => {
    if (!registrationStats?.byStatus) return {};

    const statusOrder = [
      'pending',
      'confirmed',
      'completed',
      'cancelled'
    ];

    const data = statusOrder.map((status) => {
      const item = registrationStats.byStatus.find((s) => s.status === status);
      return {
        name: getRegistrationStatusLabel(status),
        value: item?.count || 0
      };
    });

    return {
      title: {
        text: '报名转化漏斗',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}'
      },
      series: [
        {
          name: '人数',
          type: 'funnel',
          left: '10%',
          width: '80%',
          label: {
            show: true,
            position: 'inside'
          },
          labelLine: {
            length: 10,
            lineStyle: {
              width: 1,
              type: 'solid'
            }
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2
          },
          emphasis: {
            label: {
              fontSize: 14
            }
          },
          data: data
        }
      ]
    };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          数据分析
        </Title>
        <Space>
          <Select
            placeholder="选择活动"
            style={{ width: 250 }}
            allowClear
            onChange={setSelectedActivity}
          >
            {activities.map((a) => (
              <Option key={a.id} value={a.id}>
                {a.name}
              </Option>
            ))}
          </Select>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总报名人数"
              value={registrationStats?.total || 0}
              suffix="人"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已确认"
              value={
                registrationStats?.byStatus?.find(
                  (s) => s.status === 'confirmed'
                )?.count || 0
              }
              suffix="人"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={
                registrationStats?.byStatus?.find(
                  (s) => s.status === 'completed'
                )?.count || 0
              }
              suffix="人"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已取消"
              value={
                registrationStats?.byStatus?.find(
                  (s) => s.status === 'cancelled'
                )?.count || 0
              }
              suffix="人"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="报名状态分布（饼图）">
            <ReactECharts
              option={getStatusPieOption()}
              style={{ height: 400 }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="报名状态分布（柱状图）">
            <ReactECharts
              option={getStatusBarOption()}
              style={{ height: 400 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="状态明细">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {registrationStats?.byStatus?.map((item) => (
                <Tag
                  key={item.status}
                  color={
                    {
                      pending: 'orange',
                      confirmed: 'blue',
                      rescheduled: 'purple',
                      cancelled: 'red',
                      no_show: 'gold',
                      completed: 'green'
                    }[item.status]
                  }
                  style={{ fontSize: 14, padding: '4px 12px' }}
                >
                  {getRegistrationStatusLabel(item.status)}: {item.count}
                </Tag>
              ))}
            </div>

            {registrationStats?.total > 0 && (
              <div style={{ marginTop: 16 }}>
                <Title level={5}>转化率</Title>
                <p>
                  确认率：
                  {
                    (
                      ((registrationStats.byStatus.find(
                        (s) => s.status === 'confirmed'
                      )?.count || 0) /
                        registrationStats.total) *
                      100
                    ).toFixed(1)
                  }
                  %
                </p>
                <p>
                  完成率：
                  {
                    (
                      ((registrationStats.byStatus.find(
                        (s) => s.status === 'completed'
                      )?.count || 0) /
                        registrationStats.total) *
                      100
                    ).toFixed(1)
                  }
                  %
                </p>
                <p>
                  取消率：
                  {
                    (
                      ((registrationStats.byStatus.find(
                        (s) => s.status === 'cancelled'
                      )?.count || 0) /
                        registrationStats.total) *
                      100
                    ).toFixed(1)
                  }
                  %
                </p>
              </div>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <ReactECharts
              option={getConversionOption()}
              style={{ height: 350 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analytics;
