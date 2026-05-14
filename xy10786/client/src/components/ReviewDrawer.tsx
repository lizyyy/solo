import React, { useState } from 'react';
import { Drawer, Form, Button, Radio, Input, Space, message, Tag, Descriptions, Alert, List } from 'antd';
import { contentApi } from '../services/api';
import { ContentItem, ReviewAction, ContentStatus, StatusLabelMap, StatusColorMap, ChannelSync, ChannelLabelMap } from '../types';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface ReviewDrawerProps {
  visible: boolean;
  content: ContentItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const ReviewDrawer: React.FC<ReviewDrawerProps> = ({ visible, content, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    if (!content) return;

    setLoading(true);
    try {
      const res = await contentApi.review(content.id, {
        action: values.action,
        reviewer: 'admin',
        reason: values.reason,
        remark: values.remark
      });

      if (res.data.success) {
        message.success('审核操作成功');
        form.resetFields();
        onSuccess?.();
        onClose();
      } else {
        message.error(res.data.message || '审核操作失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '审核操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!content) return;

    setLoading(true);
    try {
      const res = await contentApi.retryPublish(content.id);
      if (res.data.success) {
        message.success('重试发布成功');
        onSuccess?.();
        onClose();
      } else {
        message.error(res.data.message || '重试失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '重试失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChannelRetry = async (channelId: string) => {
    setLoading(true);
    try {
      const res = await contentApi.retryChannelSync(channelId);
      if (res.data.success) {
        message.success('渠道重试成功');
        onSuccess?.();
      } else {
        message.error(res.data.message || '渠道重试失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '渠道重试失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFixChannel = async (channelId: string) => {
    const correction = prompt('请输入修正说明：');
    if (!correction) return;

    setLoading(true);
    try {
      const res = await contentApi.fixChannelSync(channelId, {
        correction,
        operator: 'admin'
      });
      if (res.data.success) {
        message.success('渠道修正成功，已重置重试次数');
        onSuccess?.();
      } else {
        message.error(res.data.message || '渠道修正失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '渠道修正失败');
    } finally {
      setLoading(false);
    }
  };

  const needsReview = content?.status === ContentStatus.NEEDS_REVIEW;
  const canRetry = content?.status === ContentStatus.FAILED || content?.status === ContentStatus.RETRYABLE;
  const hasFailedChannels = content?.channels?.some(
    ch => ch.status === ContentStatus.FAILED || ch.status === ContentStatus.RETRYABLE
  );

  return (
    <Drawer
      title="内容复核"
      width={720}
      open={visible}
      onClose={onClose}
      destroyOnClose
    >
      {content && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="标题" span={2}>
              {content.title}
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
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
            {content.scheduledAt && (
              <Descriptions.Item label="计划发布时间">
                {dayjs(content.scheduledAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            )}
          </Descriptions>

          {needsReview && content.reviewHistory && content.reviewHistory.length > 0 && (
            <Alert
              message="撤回原因"
              description={
                <div>
                  <p><strong>最后一次操作原因：</strong>{content.reviewHistory[0]?.reason}</p>
                  {content.reviewHistory[0]?.remark && (
                    <p><strong>备注：</strong>{content.reviewHistory[0]?.remark}</p>
                  )}
                </div>
              }
              type="warning"
              showIcon
            />
          )}

          {hasFailedChannels && (
            <div>
              <h4>渠道同步状态</h4>
              <List
                size="small"
                bordered
                dataSource={content.channels.filter(
                  ch => ch.status === ContentStatus.FAILED || ch.status === ContentStatus.RETRYABLE
                )}
                renderItem={(channel: ChannelSync) => (
                  <List.Item
                    actions={[
                      <Button 
                        type="link" 
                        size="small" 
                        onClick={() => handleChannelRetry(channel.id)}
                        disabled={channel.retryCount >= channel.maxRetries}
                      >
                        重试 ({channel.retryCount}/{channel.maxRetries})
                      </Button>,
                      channel.retryCount >= channel.maxRetries && (
                        <Button 
                          type="link" 
                          size="small" 
                          danger
                          onClick={() => handleFixChannel(channel.id)}
                        >
                          修正
                        </Button>
                      )
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Tag color={StatusColorMap[channel.status]}>{StatusLabelMap[channel.status]}</Tag>}
                      title={ChannelLabelMap[channel.channel]}
                      description={channel.errorMessage || '无错误信息'}
                    />
                  </List.Item>
                )}
              />
            </div>
          )}

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Form.Item
              name="action"
              label="复核操作"
              rules={[{ required: true, message: '请选择复核操作' }]}
            >
              <Radio.Group>
                <Radio value={ReviewAction.APPROVE}>审核通过</Radio>
                <Radio value={ReviewAction.REJECT}>驳回修改</Radio>
                <Radio value={ReviewAction.WITHDRAW}>撤回下线</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="reason"
              label="原因说明"
              rules={[{ required: true, message: '请输入原因说明' }]}
            >
              <TextArea rows={4} placeholder="请详细说明复核原因，该记录会被保存用于复盘" />
            </Form.Item>

            <Form.Item
              name="remark"
              label="备注（可选）"
            >
              <TextArea rows={2} placeholder="其他补充说明" />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>
                  提交复核
                </Button>
                {canRetry && content.retryCount < content.maxRetries && (
                  <Button onClick={handleRetry} loading={loading}>
                    重试发布 ({content.retryCount}/{content.maxRetries})
                  </Button>
                )}
                <Button onClick={onClose}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      )}
    </Drawer>
  );
};

export default ReviewDrawer;
