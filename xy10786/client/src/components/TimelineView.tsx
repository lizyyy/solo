import React, { useEffect, useState } from 'react';
import { Card, Timeline, Button, Space, Typography, Descriptions, Tag, Divider } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, EditOutlined } from '@ant-design/icons';
import { contentApi } from '../services/api';
import { TimelineItem, ContentItem, StatusLabelMap, StatusColorMap } from '../types';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

interface TimelineViewProps {
  contentId: string;
  onBack?: () => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ contentId, onBack }) => {
  const [content, setContent] = useState<ContentItem | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTimeline();
  }, [contentId]);

  const loadTimeline = async () => {
    if (!contentId) return;
    
    setLoading(true);
    try {
      const [contentRes, timelineRes] = await Promise.all([
        contentApi.get(contentId),
        contentApi.getTimeline(contentId)
      ]);
      
      if (contentRes.data.success) {
        setContent(contentRes.data.data);
      }
      if (timelineRes.data.success) {
        setTimeline(timelineRes.data.data);
      }
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimelineIcon = (action: string) => {
    switch (action) {
      case 'approve':
      case 'published':
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />;
      case 'reject':
      case 'withdraw':
        return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />;
      case '创建':
        return <EditOutlined style={{ color: '#1890ff', fontSize: '16px' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#faad14', fontSize: '16px' }} />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'approve':
      case 'published':
        return 'green';
      case 'reject':
      case 'withdraw':
        return 'red';
      case '创建':
        return 'blue';
      default:
        return 'gray';
    }
  };

  if (!content) {
    return <Card loading={loading} />;
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card 
        title="内容详情"
        extra={onBack && <Button onClick={onBack}>返回</Button>}
      >
        <Descriptions bordered column={2}>
          <Descriptions.Item label="标题" span={2}>
            {content.title}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={StatusColorMap[content.status]}>
              {StatusLabelMap[content.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="作者">
            {content.author}
          </Descriptions.Item>
          <Descriptions.Item label="版本">
            v{content.version}
          </Descriptions.Item>
          <Descriptions.Item label="重试次数">
            {content.retryCount}/{content.maxRetries}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(content.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          {content.scheduledAt && (
            <Descriptions.Item label="计划发布时间">
              {dayjs(content.scheduledAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          )}
          {content.publishedAt && (
            <Descriptions.Item label="实际发布时间">
              {dayjs(content.publishedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="内容摘要" span={2}>
            <Paragraph ellipsis={{ rows: 3 }}>
              {content.content}
            </Paragraph>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Divider />

      <Card title="操作时间线" loading={loading}>
        <Timeline mode="left">
          {timeline.map((item) => (
            <Timeline.Item
              key={item.id}
              dot={getTimelineIcon(item.action)}
              color={getActionColor(item.action)}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <Text strong>
                  {item.action}
                </Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  操作者：{item.operator}
                </Text>
                <Text type="secondary" style={{ marginLeft: 16 }}>
                  {dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </div>
              {item.details && item.details.reason && (
                <div>
                  <Text type="warning">原因：{item.details.reason}</Text>
                </div>
              )}
              {item.details && item.details.remark && (
                <div>
                  <Text type="secondary">备注：{item.details.remark}</Text>
                </div>
              )}
            </Space>
          </Timeline.Item>
        ))}
      </Timeline>
    </Card>
  );
};

export default TimelineView;
