import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, List, Tag, Alert, Typography, Divider } from 'antd';
import {
  FileTextOutlined,
  TeamOutlined,
  AuditOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SafetyOutlined,
  PayCircleOutlined,
} from '@ant-design/icons';
import { dashboardApi } from '../services/api';
import { DashboardData, PolicyTypeMap } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await dashboardApi.getRiskDashboard();
      setData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!data) {
    return <div>暂无数据</div>;
  }

  const { stats, alerts, summary } = data;

  return (
    <div>
      <Title level={2}>风险看板</Title>
      
      {summary && (
        <Alert
          message={summary}
          type={summary.includes('🚨') || summary.includes('⚠️') ? 'warning' : 'success'}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="有效保单"
              value={stats.total_policies}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="家庭成员"
              value={stats.total_members}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中理赔"
              value={stats.active_claims}
              prefix={<AuditOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理事件"
              value={stats.pending_incidents}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card 
            title={
              <span>
                <ClockCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />
                即将到期保单
              </span>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            {alerts.expiring_soon.length > 0 ? (
              <List
                dataSource={alerts.expiring_soon}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <span>
                          {item.policy_number}
                          <Tag color={item.days_remaining <= 7 ? 'red' : 'orange'} style={{ marginLeft: 8 }}>
                            {item.days_remaining}天后到期
                          </Tag>
                        </span>
                      }
                      description={
                        <span>
                          {item.insurance_company} - {PolicyTypeMap[item.policy_type] || item.policy_type}
                          <br />
                          被保险人: {item.member_name} | 到期日: {dayjs(item.end_date).format('YYYY-MM-DD')}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">暂无即将到期保单</Text>
            )}
          </Card>

          <Card 
            title={
              <span>
                <ExclamationCircleOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
                已过期保单
              </span>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            {alerts.already_expired.length > 0 ? (
              <List
                dataSource={alerts.already_expired}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <span>
                          {item.policy_number}
                          <Tag color="red" style={{ marginLeft: 8 }}>
                            已过期{item.days_since_expiry}天
                          </Tag>
                        </span>
                      }
                      description={
                        <span>
                          {item.insurance_company} - {PolicyTypeMap[item.policy_type] || item.policy_type}
                          <br />
                          被保险人: {item.member_name} | 原到期日: {dayjs(item.end_date).format('YYYY-MM-DD')}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">暂无已过期保单</Text>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card 
            title={
              <span>
                <WarningOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
                报案期限预警
              </span>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            {alerts.urgent_reports.length > 0 ? (
              <List
                dataSource={alerts.urgent_reports}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <span>
                          {item.incident_number} - {item.incident_type}
                          {item.is_overdue ? (
                            <Tag color="red" style={{ marginLeft: 8 }}>已逾期</Tag>
                          ) : (
                            <Tag color="orange" style={{ marginLeft: 8 }}>剩余{item.days_remaining}天</Tag>
                          )}
                        </span>
                      }
                      description={
                        <span>
                          出险日期: {dayjs(item.incident_date).format('YYYY-MM-DD')}
                          <br />
                          涉及成员: {item.member_name}
                          <br />
                          {item.description}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">暂无报案期限预警</Text>
            )}
          </Card>

          <Card 
            title={
              <span>
                <SafetyOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                可能重复保障
              </span>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            {alerts.duplicate_coverages.length > 0 ? (
              <List
                dataSource={alerts.duplicate_coverages}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <span>
                          {item.member_name} - {PolicyTypeMap[item.policy_type] || item.policy_type}
                          <Tag color="blue" style={{ marginLeft: 8 }}>{item.policies.length}份保单</Tag>
                        </span>
                      }
                      description={
                        <span>
                          总保额: ¥{item.total_limit.toLocaleString()}
                          <br />
                          保单: {item.policies.map(p => p.policy_number).join(', ')}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">未发现重复保障</Text>
            )}
          </Card>

          <Card 
            title={
              <span>
                <PayCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />
                免赔额未达标
              </span>
            }
            size="small"
          >
            {alerts.pending_deductibles.length > 0 ? (
              <List
                dataSource={alerts.pending_deductibles}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <span>
                          {item.policy_number} - {item.insurance_company}
                        </span>
                      }
                      description={
                        <span>
                          被保险人: {item.member_name}
                          <br />
                          免赔额: ¥{item.total_deductible.toLocaleString()} | 已累计: ¥{item.total_deducted.toLocaleString()}
                          <br />
                          <Text type="warning">剩余: ¥{item.remaining.toLocaleString()}</Text>
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">所有保单免赔额均已达标</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
