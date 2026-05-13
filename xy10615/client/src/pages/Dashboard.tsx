import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Progress, Space, List, Typography } from 'antd';
import {
  SwapOutlined,
  ToolOutlined,
  BoxOutlined,
  FileSearchOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import StatCard from '../components/StatCard';
import { LineChangeStatusTag, CheckStatusTag, KittingStatusTag, InspectionStatusTag } from '../components/StatusTag';
import { statisticsApi, plansApi, missingItemApi } from '../api';
import { Statistics, LineChangePlan, MissingItem } from '../types';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [recentPlans, setRecentPlans] = useState<LineChangePlan[]>([]);
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, plansRes, missingRes] = await Promise.all([
        statisticsApi.get(),
        plansApi.getAll(),
        missingItemApi.getAll()
      ]);

      if (statsRes.data.success) {
        setStatistics(statsRes.data.data);
      }
      if (plansRes.data.success) {
        setRecentPlans(plansRes.data.data?.slice(0, 5) || []);
      }
      if (missingRes.data.success) {
        setMissingItems(missingRes.data.data?.filter(m => m.status !== 'CLOSED').slice(0, 5) || []);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  if (!statistics) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>数据概览</Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <StatCard
            title="换线计划总数"
            value={statistics.plans.total}
            prefix={<SwapOutlined />}
            extra={
              <Space direction="vertical" style={{ width: '100%' }} size={0}>
                <Text type="secondary">今日计划: {statistics.plans.todayPlans}</Text>
                <Text type="secondary">延迟计划: {statistics.plans.delayedPlans}</Text>
              </Space>
            }
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard
            title="模具点检"
            value={statistics.moldInspections.total}
            prefix={<ToolOutlined />}
            extra={
              <Space direction="vertical" style={{ width: '100%' }} size={0}>
                <Text type="secondary">待复核: {statistics.moldInspections.pendingReview}</Text>
              </Space>
            }
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard
            title="物料齐套率"
            value={statistics.materialKittings.completeRate}
            suffix="%"
            prefix={<BoxOutlined />}
            progress={statistics.materialKittings.completeRate}
            progressColor="#52c41a"
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard
            title="首件检验通过率"
            value={statistics.firstArticles.passRate}
            suffix="%"
            prefix={<FileSearchOutlined />}
            progress={statistics.firstArticles.passRate}
            progressColor="#1890ff"
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard
            title="待处理缺项"
            value={statistics.missingItems.byStatus.OPEN + statistics.missingItems.byStatus.IN_PROGRESS}
            prefix={<ExclamationCircleOutlined />}
            valueStyle={{ color: '#ff4d4f' }}
            extra={
              <Text type="secondary">已逾期: {statistics.missingItems.overdue}</Text>
            }
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="最近换线计划">
            <List
              dataSource={recentPlans}
              renderItem={(plan) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{plan.planNo}</Text>
                        <LineChangeStatusTag status={plan.status} />
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text>{plan.productName}</Text>
                        <Text type="secondary">负责人: {plan.responsiblePerson}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="待处理缺项">
            <List
              dataSource={missingItems}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{item.name}</Text>
                        <KittingStatusTag status={item.status === 'OPEN' ? 'MISSING' : 'IN_PROGRESS'} />
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary">{item.description}</Text>
                        <Text type="secondary">负责人: {item.responsiblePerson}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
