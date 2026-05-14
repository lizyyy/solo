import React from 'react';
import { Timeline, Card, Tag, Typography, Avatar } from 'antd';
import { 
  EditOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  ShareAltOutlined,
  UndoOutlined,
  FileProtectOutlined,
  StopOutlined,
  RollbackOutlined,
  ToolOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { statusMap } from '../services/api';

const { Text, Paragraph } = Typography;

const statusIcons = {
  draft: <EditOutlined />,
  pending_approval: <ClockCircleOutlined />,
  approved: <CheckCircleOutlined />,
  rejected: <CloseCircleOutlined />,
  published: <ShareAltOutlined />,
  revoked: <UndoOutlined />,
  archived: <FileProtectOutlined />,
  cancelled: <StopOutlined />,
  recalled: <RollbackOutlined />,
  correction_pending: <ToolOutlined />
};

const ApprovalTimeline = ({ timeline, annotation }) => {
  return (
    <Card title="审批时间线" extra={<Tag color={statusMap[annotation?.status]?.color}>{statusMap[annotation?.status]?.label}</Tag>}>
      <Timeline mode="left">
        {timeline.map((item, index) => (
          <Timeline.Item
            key={item.id}
            color={item.status === 'approved' || item.status === 'published' ? 'green' : item.status === 'rejected' ? 'red' : 'blue'}
            dot={statusIcons[item.status]}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Tag color={statusMap[item.status]?.color}>{statusMap[item.status]?.label}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {moment(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>
                  {(item.approver || 'S')[0].toUpperCase()}
                </Avatar>
                <Text strong>{item.approver || '系统'}</Text>
              </div>
              {item.comment && (
                <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13 }}>
                  {item.comment}
                </Paragraph>
              )}
            </div>
          </Timeline.Item>
        ))}
        {timeline.length === 0 && (
          <Timeline.Item>
            <Text type="secondary">暂无审批记录</Text>
          </Timeline.Item>
        )}
      </Timeline>
    </Card>
  );
};

export default ApprovalTimeline;
