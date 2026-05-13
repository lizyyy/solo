import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { ArrowUpOutlined, CheckCircleOutlined, ClockCircleOutlined, StopOutlined, RollbackOutlined } from '@ant-design/icons';

interface StatCardsProps {
  data: {
    totalRequests: number;
    pendingRequests: number;
    processingRequests: number;
    completedRequests: number;
    rolledBackRequests: number;
    totalServices: number;
    failedServices: number;
    totalReports: number;
    successReports: number;
    failedReports: number;
    rolledBackReports: number;
    totalRollbacks: number;
  };
}

const StatCards: React.FC<StatCardsProps> = ({ data }) => {
  return (
    <Row gutter={[16, 16]}>
      <Col span={4}>
        <Card>
          <Statistic
            title="总申请数"
            value={data.totalRequests}
            prefix={<ArrowUpOutlined />}
            valueStyle={{ color: '#3f8600' }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="待审批"
            value={data.pendingRequests}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="发布中"
            value={data.processingRequests}
            prefix={<ArrowUpOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="已完成"
            value={data.completedRequests}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="已回滚"
            value={data.rolledBackRequests}
            prefix={<RollbackOutlined />}
            valueStyle={{ color: '#ff4d4f' }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="发布异常"
            value={data.failedServices}
            prefix={<StopOutlined />}
            valueStyle={{ color: '#f5222d' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default StatCards;
