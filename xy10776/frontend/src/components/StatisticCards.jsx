import React from 'react';
import { Row, Col, Card, Statistic, Progress, Tag } from 'antd';
import { 
  RiseOutlined, 
  FallOutlined, 
  BarChartOutlined, 
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import moment from 'moment';

const StatisticCards = ({ statistics, annotations }) => {
  const statusCounts = annotations.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="总注释数"
            value={annotations.length}
            prefix={<BarChartOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="已发布"
            value={statusCounts.published || 0}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="待审批"
            value={statusCounts.pending_approval || 0}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic
            title="待修正"
            value={statusCounts.correction_pending || 0}
            prefix={<WarningOutlined />}
            valueStyle={{ color: '#ff4d4f' }}
          />
        </Card>
      </Col>

      {statistics.slice(0, 4).map((stat, index) => (
        <Col xs={24} sm={12} md={6} key={index}>
          <Card size="small" title={`${stat.chart_code} - ${stat.metric_name}`}>
            <div style={{ marginBottom: 8 }}>
              <small>平均值: {stat.avg_value.toFixed(2)}</small>
            </div>
            <Progress 
              percent={Math.min((stat.avg_value / stat.max_value) * 100, 100)} 
              size="small"
              strokeColor="#1890ff"
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <Tag color="green">最小: {stat.min_value.toFixed(0)}</Tag>
              <Tag color="red">最大: {stat.max_value.toFixed(0)}</Tag>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default StatisticCards;
