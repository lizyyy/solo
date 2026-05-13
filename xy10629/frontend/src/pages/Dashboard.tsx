import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Space, Badge } from 'antd';
import {
  BoxPlotOutlined,
  RetweetOutlined,
  ClearOutlined,
  ThunderboltOutlined,
  SendOutlined,
  WarningOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { statisticsAPI } from '../services/api';
import { Statistics, Anomalies } from '../types';

const Dashboard: React.FC = () => {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [anomalies, setAnomalies] = useState<Anomalies | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statRes, anomalyRes] = await Promise.all([
        statisticsAPI.getOverview(),
        statisticsAPI.getAnomalies(),
      ]);
      setStatistics(statRes.data.data);
      setAnomalies(anomalyRes.data.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  const getDepartmentChartOption = () => {
    if (!statistics) return {};
    return {
      title: { text: '科室回收统计', left: 'center', fontSize: 14 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: statistics.topDepartments.map(d => d.department),
      },
      yAxis: { type: 'value' },
      series: [
        {
          data: statistics.topDepartments.map(d => d.count),
          type: 'bar',
          itemStyle: { color: '#1890ff' },
        },
      ],
    };
  };

  const getHandlerChartOption = () => {
    if (!statistics) return {};
    return {
      title: { text: '处理人工作量统计', left: 'center', fontSize: 14 },
      tooltip: { trigger: 'item' },
      series: [
        {
          name: '工作量',
          type: 'pie',
          radius: '60%',
          data: statistics.topHandlers.map(h => ({ value: h.count, name: h.name })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  };

  const cleaningColumns = [
    { title: '清洗编号', dataIndex: 'cleaning_no', key: 'cleaning_no' },
    { title: '器械包', dataIndex: 'package_name', key: 'package_name' },
    { title: '清洗员', dataIndex: 'cleaner', key: 'cleaner' },
    { title: '清洗方式', dataIndex: 'cleaning_method', key: 'cleaning_method' },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: (result: string) => (
        <Tag color="red">{result === 'failed' ? '失败' : result}</Tag>
      ),
    },
  ];

  const sterilizationColumns = [
    { title: '批次编号', dataIndex: 'batch_no', key: 'batch_no' },
    { title: '灭菌员', dataIndex: 'sterilizer', key: 'sterilizer' },
    { title: '灭菌方式', dataIndex: 'sterilization_method', key: 'sterilization_method' },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: (result: string) => (
        <Tag color="red">{result === 'failed' ? '失败' : result}</Tag>
      ),
    },
  ];

  const isolationColumns = [
    { title: '隔离编号', dataIndex: 'isolation_no', key: 'isolation_no' },
    { title: '来源类型', dataIndex: 'source_type', key: 'source_type' },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '处理人', dataIndex: 'handler', key: 'handler' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'isolated' ? 'orange' : 'green'}>
          {status === 'isolated' ? '隔离中' : '已处理'}
        </Tag>
      ),
    },
  ];

  if (!statistics) return <div>加载中...</div>;

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="器械包总数"
              value={statistics.totalPackages}
              prefix={<BoxPlotOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="回收总数"
              value={statistics.totalRecovery}
              prefix={<RetweetOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="清洗总数"
              value={statistics.totalCleaning}
              prefix={<ClearOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="灭菌总数"
              value={statistics.totalSterilization}
              prefix={<ThunderboltOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="发放总数"
              value={statistics.totalDistribution}
              prefix={<SendOutlined style={{ color: '#13c2c2' }} />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Badge count={statistics.pendingCleaning + statistics.failedCleaning + statistics.failedSterilization + statistics.activeIsolations}>
              <Statistic
                title="异常待处理"
                value={statistics.activeIsolations}
                prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Badge>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="待处理事项" className="anomaly-card">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><ClockCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />待清洗</span>
                <Tag color="orange">{statistics.pendingCleaning} 个</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />清洗失败</span>
                <Tag color="red">{statistics.failedCleaning} 个</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />灭菌失败</span>
                <Tag color="red">{statistics.failedSterilization} 个</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><WarningOutlined style={{ color: '#fa8c16', marginRight: 8 }} />隔离中</span>
                <Tag color="orange">{statistics.activeIsolations} 个</Tag>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <ReactECharts option={getHandlerChartOption()} style={{ height: 300 }} />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <ReactECharts option={getDepartmentChartOption()} style={{ height: 300 }} />
        </Col>
      </Row>

      {anomalies && (
        <>
          {anomalies.failedCleaning.length > 0 && (
            <Card title="清洗失败记录" style={{ marginBottom: 16 }}>
              <Table
                columns={cleaningColumns}
                dataSource={anomalies.failedCleaning}
                rowKey="id"
                size="small"
                pagination={false}
              />
            </Card>
          )}

          {anomalies.failedSterilization.length > 0 && (
            <Card title="灭菌失败记录" style={{ marginBottom: 16 }}>
              <Table
                columns={sterilizationColumns}
                dataSource={anomalies.failedSterilization}
                rowKey="id"
                size="small"
                pagination={false}
              />
            </Card>
          )}

          {anomalies.activeIsolations.length > 0 && (
            <Card title="异常隔离记录">
              <Table
                columns={isolationColumns}
                dataSource={anomalies.activeIsolations}
                rowKey="id"
                size="small"
                pagination={false}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
