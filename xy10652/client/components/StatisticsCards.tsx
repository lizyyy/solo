import React from 'react';
import { Card, Row, Col, Statistic, Progress } from 'antd';
import { BoxPlotOutlined, ClockCircleOutlined, AuditOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Statistics } from '../types';

interface StatisticsCardsProps {
  data: Statistics | null;
  loading: boolean;
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({ data, loading }) => {
  return (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="样品批次总数"
            value={data?.totalBatches || 0}
            prefix={<BoxPlotOutlined style={{ color: '#1890ff' }} />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="待评审"
            value={data?.pending || 0}
            valueStyle={{ color: '#faad14' }}
            prefix={<ClockCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="评审中"
            value={data?.reviewing || 0}
            valueStyle={{ color: '#1890ff' }}
            prefix={<AuditOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="已定版"
            value={data?.finalized || 0}
            valueStyle={{ color: '#52c41a' }}
            prefix={<CheckCircleOutlined />}
          />
          <Progress
            percent={Math.round(((data?.finalized || 0) / (data?.totalBatches || 1)) * 100)}
            size="small"
            style={{ marginTop: 12 }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default StatisticsCards;
