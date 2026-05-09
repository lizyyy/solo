import { Card, List, Tag, Button, Typography, Space, Tooltip, Alert } from 'antd';
import { WarningOutlined, CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useOverdueFollowUps, useCompleteFollowUp } from '@/api/followups.api';
import { FollowUpType } from '@/types';
import dayjs from 'dayjs';
import { Modal, Input, message } from 'antd';

const { Title, Text } = Typography;

const FOLLOWUP_TYPE_MAP: Record<FollowUpType, string> = {
  [FollowUpType.CALL]: '电话回访',
  [FollowUpType.MESSAGE]: '短信/站内信',
  [FollowUpType.EMAIL]: '邮件',
  [FollowUpType.COMPENSATION]: '补偿处理',
  [FollowUpType.VISIT]: '上门访问',
  [FollowUpType.OTHER]: '其他',
};

export function OverdueFollowUpsPage() {
  const navigate = useNavigate();
  const { data: followUps = [], isLoading, refetch } = useOverdueFollowUps();
  const completeFollowUpMutation = useCompleteFollowUp();

  const handleComplete = (item: { id: string; ticketId: string; content: string }) => {
    Modal.confirm({
      title: '完成跟进',
      content: (
        <div>
          <Alert
            message="此跟进已逾期"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Text>工单: {item.content.substring(0, 50)}...</Text>
          <div style={{ marginTop: 8 }}>
            <Text>请输入完成说明：</Text>
          </div>
          <Input.TextArea
            id="complete-note"
            rows={3}
            style={{ marginTop: 8 }}
            placeholder="请输入完成跟进的详细说明..."
          />
        </div>
      ),
      onOk: async () => {
        const noteInput = document.getElementById('complete-note') as HTMLTextAreaElement;
        const note = noteInput?.value || '已完成';

        try {
          await completeFollowUpMutation.mutateAsync({
            id: item.id,
            data: { completionNote: note },
          });
          message.success('跟进已完成');
          refetch();
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const getOverdueDays = (deadline: string | undefined) => {
    if (!deadline) return 0;
    return dayjs().diff(dayjs(deadline), 'day');
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>逾期跟进提醒</Title>

      {followUps.length > 0 && (
        <Alert
          message={`您有 ${followUps.length} 条跟进记录已逾期，请尽快处理`}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        {followUps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 50 }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
            <div style={{ marginTop: 16, color: '#999' }}>暂无逾期跟进</div>
          </div>
        ) : (
          <List
            loading={isLoading}
            dataSource={followUps}
            renderItem={(item) => {
              const overdueDays = getOverdueDays(item.promisedDeadline);
              return (
                <List.Item
                  style={{
                    borderBottom: '1px solid #f0f0f0',
                    padding: '16px 0',
                    background: overdueDays > 3 ? '#fff1f0' : '#fffbe6',
                  }}
                  actions={[
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => navigate(`/tickets/${item.ticketId}`)}
                    >
                      查看工单
                    </Button>,
                    <Button
                      type="primary"
                      danger={overdueDays > 3}
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleComplete(item)}
                    >
                      完成
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color="red">
                          {FOLLOWUP_TYPE_MAP[item.followUpType] || item.followUpType}
                        </Tag>
                        <Tag color="red">逾期 {overdueDays} 天</Tag>
                        <span style={{ fontWeight: 500 }}>
                          {item.content}
                        </span>
                      </Space>
                    }
                    description={
                      <div style={{ marginTop: 8 }}>
                        {item.promisedAction && (
                          <div style={{ marginBottom: 4, color: '#1890ff' }}>
                            <strong>承诺：</strong>{item.promisedAction}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 24, color: '#999', fontSize: 12 }}>
                          <span>创建时间: {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                          {item.promisedDeadline && (
                            <Tooltip title={`承诺截止: ${dayjs(item.promisedDeadline).format('YYYY-MM-DD HH:mm')}`}>
                              <span style={{ color: '#f5222d' }}>
                                <WarningOutlined style={{ marginRight: 4 }} />
                                承诺截止: {dayjs(item.promisedDeadline).format('YYYY-MM-DD HH:mm')}
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    </div>
  );
}

export default OverdueFollowUpsPage;
