import React, { useEffect, useState } from 'react';
import { Card, Timeline, Button, Space, Typography, Descriptions, Tag, Spin, Alert } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined } from '@ant-design/icons';
import { contentApi } from '../services/api';
import { ContentItem, ContentStatus, StatusLabelMap, StatusColorMap } from '../types';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

interface TimelineViewProps {
  contentId: string;
  onBack?: () => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ contentId, onBack }) => {
  const [content, setContent] = useState<ContentItem | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contentId) {
      loadTimeline();
    }
  }, [contentId]);

  const loadTimeline = async () => {
    if (!contentId) return;
    
    setLoading(true);
    setError(null);
    try {
      const [contentResult, timelineResult] = await Promise.all([
        contentApi.get(contentId),
        contentApi.getTimeline(contentId)
      ]);
      
      if (contentResult.success) {
        setContent(contentResult.data || null);
      } else {
        setError(contentResult.message || 'Failed to load content');
      }
      
      if (timelineResult.success) {
        setTimeline(timelineResult.data || []);
      } else {
        console.error('Failed to load timeline:', timelineResult.message);
      }
    } catch (error: any) {
      console.error('Failed to load timeline:', error);
      setError(error.message || 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  const getTimelineIcon = (action: string) => {
    if (action.includes('Approve') || action.includes('Published') || action.includes('Synced')) {
      return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />;
    }
    if (action.includes('Reject') || action.includes('Withdraw') || action.includes('Failed')) {
      return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />;
    }
    if (action.includes('Create')) {
      return <EditOutlined style={{ color: '#1890ff', fontSize: '16px' }} />;
    }
    return <ClockCircleOutlined style={{ color: '#faad14', fontSize: '16px' }} />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('Approve') || action.includes('Published') || action.includes('Synced')) {
      return 'green';
    }
    if (action.includes('Reject') || action.includes('Withdraw') || action.includes('Failed')) {
      return 'red';
    }
    if (action.includes('Create')) {
      return 'blue';
    }
    return 'gray';
  };

  const parseRemark = (remark: string) => {
    try {
      if (remark.startsWith('{') || remark.startsWith('[')) {
        return JSON.parse(remark);
      }
      return remark;
    } catch {
      return remark;
    }
  };

  const formatDetails = (details: any) => {
    if (!details) return null;
    const result = [];
    if (details.reason) {
      result.push(<div key="reason"><Text type="warning">Reason: {details.reason}</Text></div>);
    }
    if (details.remark) {
      const parsed = parseRemark(details.remark);
      if (typeof parsed === 'string') {
        result.push(<div key="remark"><Text type="secondary">Remark: {parsed}</Text></div>);
      } else {
        result.push(
          <div key="details">
            <Text type="secondary">
            Details: {JSON.stringify(parsed, null, 2)}
            </Text>
          </div>
        );
      }
    }
    if (details.message && !details.reason) {
      result.push(<div key="message"><Text type="info">Info: {details.message}</Text></div>);
    }
    return result.length > 0 ? result : null;
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert message="Error" description={error} type="error" showIcon />
      </div>
    );
  }

  if (!content) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Content not found</p>
      </div>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card 
        title="Content Details"
        extra={onBack && <Button onClick={onBack}>Back</Button>}
      >
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Title" span={2}>
            {content.title}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={StatusColorMap[content.status]}>
              {StatusLabelMap[content.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Author">
            {content.author}
          </Descriptions.Item>
          <Descriptions.Item label="Version">
            v{content.version}
          </Descriptions.Item>
          <Descriptions.Item label="Retry Count">
            {content.retryCount}/{content.maxRetries}
          </Descriptions.Item>
          <Descriptions.Item label="Created At">
            {dayjs(content.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          {content.scheduledAt && (
            <Descriptions.Item label="Scheduled Publish Time">
              {dayjs(content.scheduledAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          )}
          {content.publishedAt && (
            <Descriptions.Item label="Actual Publish Time">
              {dayjs(content.publishedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Content Summary" span={2}>
            <Paragraph ellipsis={{ rows: 3 }}>
              {content.content}
            </Paragraph>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Channel Sync Status">
        {content.channels && content.channels.length > 0 ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            {content.channels.map((channel: any) => (
              <Tag key={channel.id} color={StatusColorMap[channel.status]}>
                {channel.channel}: {StatusLabelMap[channel.status]} 
                {channel.syncedAt && ` (Synced at: ${dayjs(channel.syncedAt).format('MM-DD HH:mm')})`}
              </Tag>
            ))}
          </Space>
        ) : (
          <p>No channels configured</p>
        )}
      </Card>

      <Card title="Operation Timeline">
        {timeline && timeline.length > 0 ? (
          <Timeline mode="left">
            {timeline.map((item: any) => (
              <Timeline.Item
                key={item.id}
                dot={getTimelineIcon(item.action)}
                color={getActionColor(item.action)}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div>
                    <Text strong style={{ fontSize: '14px' }}>
                      {item.action}
                    </Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      <small>Operator: {item.operator}</small>
                    </Text>
                    <Text type="secondary" style={{ marginLeft: 16 }}>
                      <small>{dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss')}</small>
                    </Text>
                  </div>
                  {formatDetails(item.details)}
                </Space>
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <p>No timeline records</p>
        )}
      </Card>
    </Space>
  );
};

export default TimelineView;
