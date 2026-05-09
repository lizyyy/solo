import { Card, Row, Col, Statistic, Progress, Tag, Typography, List, Button } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTicketStats } from '@/api/tickets.api';
import { useFollowUpStats, useOverdueFollowUps, usePendingFollowUps } from '@/api/followups.api';
import { TicketStatus, TicketPriority, FollowUpStatus, FollowUpType } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: '待处理',
  [TicketStatus.IN_PROGRESS]: '处理中',
  [TicketStatus.PENDING_FOLLOWUP]: '待跟进',
  [TicketStatus.COMPLETED]: '已完成',
  [TicketStatus.CLOSED]: '已关闭',
  [TicketStatus.CANCELLED]: '已取消',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: '低',
  [TicketPriority.NORMAL]: '中',
  [TicketPriority.HIGH]: '高',
  [TicketPriority.URGENT]: '紧急',
};

const FOLLOWUP_TYPE_LABELS: Record<FollowUpType, string> = {
  [FollowUpType.CALL]: '电话回访',
  [FollowUpType.MESSAGE]: '短信/站内信',
  [FollowUpType.EMAIL]: '邮件',
  [FollowUpType.COMPENSATION]: '补偿处理',
  [FollowUpType.VISIT]: '上门访问',
  [FollowUpType.OTHER]: '其他',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: ticketStats } = useTicketStats();
  const { data: followUpStats } = useFollowUpStats();
  const { data: overdueFollowUps = [] } = useOverdueFollowUps();
  const { data: pendingFollowUps = [] } = usePendingFollowUps();

  const totalTickets = ticketStats?.total || 0;
  const openTickets = ticketStats?.byStatus?.[TicketStatus.OPEN] || 0;
  const inProgressTickets = ticketStats?.byStatus?.[TicketStatus.IN_PROGRESS] || 0;
  const urgentTickets = ticketStats?.byPriority?.[TicketPriority.URGENT] || 0;

  const totalFollowUps = followUpStats?.total || 0;
  const completedFollowUps = followUpStats?.byStatus?.[FollowUpStatus.COMPLETED] || 0;
  const overdueFollowUpsCount = followUpStats?.overdue || 0;
  const pendingThisWeek = followUpStats?.byStatus?.[FollowUpStatus.PENDING] || 0;

  const completionRate = totalFollowUps > 0
    ? Math.round((completedFollowUps / totalFollowUps) * 100)
    : 0;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>仪表盘</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="工单总数"
              value={totalTickets}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待处理"
              value={openTickets}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="处理中"
              value={inProgressTickets}
              prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="紧急工单"
              value={urgentTickets}
              prefix={<WarningOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="跟进完成率"
              value={completionRate}
              suffix="%"
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待跟进"
              value={pendingThisWeek}
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="逾期跟进"
              value={overdueFollowUpsCount}
              prefix={<WarningOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="本周完成"
              value={followUpStats?.completedThisWeek || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="工单状态分布" extra={<Button type="link" onClick={() => navigate('/tickets')}>查看全部</Button>}>
            <div style={{ padding: 8 }}>
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const count = ticketStats?.byStatus?.[key as TicketStatus] || 0;
                const percent = totalTickets > 0 ? (count / totalTickets) * 100 : 0;
                return (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text>{label}</Text>
                      <Text type="secondary">{count} 个</Text>
                    </div>
                    <Progress percent={Math.round(percent)} showInfo={false} size="small" />
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="工单优先级分布" extra={<Button type="link" onClick={() => navigate('/tickets')}>查看全部</Button>}>
            <div style={{ padding: 8 }}>
              {Object.entries(PRIORITY_LABELS).map(([key, label]) => {
                const count = ticketStats?.byPriority?.[key as TicketPriority] || 0;
                const percent = totalTickets > 0 ? (count / totalTickets) * 100 : 0;
                const colorMap: Record<string, string> = {
                  [TicketPriority.LOW]: '#d9d9d9',
                  [TicketPriority.NORMAL]: '#1890ff',
                  [TicketPriority.HIGH]: '#fa8c16',
                  [TicketPriority.URGENT]: '#f5222d',
                };
                return (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text>{label}</Text>
                      <Text type="secondary">{count} 个</Text>
                    </div>
                    <Progress percent={Math.round(percent)} showInfo={false} size="small" strokeColor={colorMap[key]} />
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card
            title="逾期跟进提醒"
            extra={<Button type="link" onClick={() => navigate('/followups/overdue')}>查看全部</Button>}
            style={{ borderColor: '#ffccc7' }}
          >
            {overdueFollowUps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#52c41a' }}>
                <CheckCircleOutlined style={{ fontSize: 32 }} />
                <div style={{ marginTop: 8 }}>暂无逾期跟进</div>
              </div>
            ) : (
              <List
                dataSource={overdueFollowUps.slice(0, 5)}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        type="link"
                        size="small"
                        key="view"
                        onClick={() => navigate(`/tickets/${item.ticketId}`)}
                      >
                        处理
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color="red">逾期</Tag>
                          <span style={{ fontSize: 14 }}>{item.content.substring(0, 30)}...</span>
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            类型: {FOLLOWUP_TYPE_LABELS[item.followUpType]}
                          </div>
                          <div style={{ fontSize: 12, color: '#f5222d' }}>
                            承诺时间: {item.promisedDeadline ? dayjs(item.promisedDeadline).format('YYYY-MM-DD HH:mm') : '-'}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title="待跟进任务"
            extra={<Button type="link" onClick={() => navigate('/followups/pending')}>查看全部</Button>}
          >
            {pendingFollowUps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#52c41a' }}>
                <CheckCircleOutlined style={{ fontSize: 32 }} />
                <div style={{ marginTop: 8 }}>暂无待跟进任务</div>
              </div>
            ) : (
              <List
                dataSource={pendingFollowUps.slice(0, 5)}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        type="link"
                        size="small"
                        key="view"
                        onClick={() => navigate(`/tickets/${item.ticketId}`)}
                      >
                        查看
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color="blue">待跟进</Tag>
                          <span style={{ fontSize: 14 }}>{item.content.substring(0, 30)}...</span>
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            类型: {FOLLOWUP_TYPE_LABELS[item.followUpType]}
                          </div>
                          {item.promisedDeadline && (
                            <div style={{ fontSize: 12, color: '#fa8c16' }}>
                              截止: {dayjs(item.promisedDeadline).format('YYYY-MM-DD HH:mm')}
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default DashboardPage;
