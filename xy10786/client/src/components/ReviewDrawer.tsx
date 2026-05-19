import React, { useState } from 'react';
import { Drawer, Form, Button, Radio, Input, Space, message, Tag, Descriptions, Alert, List, Modal } from 'antd';
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
  const [fixModalVisible, setFixModalVisible] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<ChannelSync | null>(null);

  const handleSubmit = async (values: any) => {
    if (!content) return;

    setLoading(true);
    try {
      const result = await contentApi.review(content.id, {
        action: values.action,
        reviewer: 'admin',
        reason: values.reason,
        remark: values.remark
      });

      if (result.success || result.code === 409 || result.code === 202) {
        message.success(result.message || 'Review completed successfully');
        form.resetFields();
        onSuccess?.();
        onClose();
      } else {
        message.error(result.message || 'Review operation failed');
      }
    } catch (error: any) {
      message.error(error.message || 'Review operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!content) return;

    setLoading(true);
    try {
      const result = await contentApi.retryPublish(content.id);
      if (result.success) {
        message.success(result.message || 'Retry published successfully');
        onSuccess?.();
        onClose();
      } else if (result.code === 403) {
        message.warning(result.message || 'Max retries reached, please review and fix the issue');
      } else {
        message.error(result.message || 'Retry failed');
      }
    } catch (error: any) {
      message.error(error.message || 'Retry failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChannelRetry = async (channelId: string) => {
    setLoading(true);
    try {
      const result = await contentApi.retryChannelSync(channelId);
      if (result.success) {
        message.success(result.message || 'Channel retry successful');
        onSuccess?.();
      } else if (result.code === 403) {
        message.warning(result.message || 'Max retries reached for channel');
      } else {
        message.error(result.message || 'Channel retry failed');
      }
    } catch (error: any) {
      message.error(error.message || 'Channel retry failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFixChannel = async (channelId: string, correction: string) => {
    setLoading(true);
    try {
      const result = await contentApi.fixChannelSync(channelId, {
        correction,
        operator: 'admin'
      });
      if (result.success || result.code === 409) {
        message.success(result.message || 'Channel fix applied successfully, ready for retry');
        onSuccess?.();
        setFixModalVisible(false);
      } else {
        message.error(result.message || 'Failed to apply channel fix');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to apply channel fix');
    } finally {
      setLoading(false);
    }
  };

  const isPendingReview = content?.status === ContentStatus.PENDING_REVIEW;
  const needsReview = content?.status === ContentStatus.NEEDS_REVIEW;
  const canRetry = content?.status === ContentStatus.FAILED || content?.status === ContentStatus.RETRYABLE;
  const canChannelFix = content?.channels?.some(
    ch => ch.status === ContentStatus.FAILED || ch.status === ContentStatus.RETRYABLE
  );
  const canPublish = content?.status === ContentStatus.APPROVED || content?.status === ContentStatus.SCHEDULED;

  return (
    <>
      <Drawer
        title="Content Review"
        width={720}
        open={visible}
        onClose={onClose}
        destroyOnClose
      >
        {content && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Title" span={2}>
                {content.title}
              </Descriptions.Item>
              <Descriptions.Item label="Current Status">
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
              {content.scheduledAt && (
                <Descriptions.Item label="Scheduled Publish Time">
                  {dayjs(content.scheduledAt).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {needsReview && content.reviewHistory && content.reviewHistory.length > 0 && (
              <Alert
                message="Withdrawal Reason"
                description={
                  <div>
                    <p><strong>Last Operation Reason:</strong> {content.reviewHistory[0]?.reason}</p>
                    {content.reviewHistory[0]?.remark && (
                      <p><strong>Remark:</strong> {content.reviewHistory[0]?.remark}</p>
                    )}
                  </div>
                }
                type="warning"
                showIcon
              />
            )}

            {canRetry && (
              <Alert
                message="Retry Available"
                description={`You can retry publishing this content. Remaining retries: ${content.maxRetries - content.retryCount}`}
                type="info"
                showIcon
              />
            )}

            {hasFailedChannels && (
              <div>
                <h4>Channel Sync Status</h4>
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
                          Retry ({channel.retryCount}/{channel.maxRetries})
                        </Button>,
                        channel.retryCount >= channel.maxRetries && (
                          <Button 
                            type="link" 
                            size="small" 
                            danger
                            onClick={() => { setSelectedChannel(channel); setFixModalVisible(true); }}
                          >
                            Fix & Reset
                          </Button>
                        )
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Tag color={StatusColorMap[channel.status]}>{StatusLabelMap[channel.status]}</Tag>}
                        title={ChannelLabelMap[channel.channel]}
                        description={channel.errorMessage || 'No error message'}
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
                label="Review Action"
                rules={[{ required: true, message: 'Please select review action' }]}
              >
                <Radio.Group>
                  {isPendingReview && (
                    <>
                      <Radio value={ReviewAction.APPROVE}>Approve</Radio>
                      <Radio value={ReviewAction.REJECT}>Reject (Send Back)</Radio>
                    </>
                  )}
                  {needsReview && (
                    <>
                      <Radio value={ReviewAction.RESUBMIT}>Resubmit for Review</Radio>
                      <Radio value={ReviewAction.WITHDRAW}>Withdraw</Radio>
                    </>
                  )}
                  {!isPendingReview && !needsReview && (
                    <>
                      <Radio value={ReviewAction.WITHDRAW}>Withdraw</Radio>
                    </>
                  )}
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="reason"
                label="Reason"
                rules={[{ required: true, message: 'Please enter reason' }]}
              >
                <TextArea rows={4} placeholder="Please provide detailed reason for review. This record will be saved for audit." />
              </Form.Item>

              <Form.Item
                name="remark"
                label="Remark (Optional)"
              >
                <TextArea rows={2} placeholder="Additional remarks" />
              </Form.Item>

              <Form.Item>
                <Space wrap>
                  {(isPendingReview || needsReview) && (
                    <Button type="primary" htmlType="submit" loading={loading}>
                      {isPendingReview ? 'Submit Review' : 'Submit Resubmission'}
                    </Button>
                  )}
                  {!isPendingReview && !needsReview && (
                    <Button type="primary" htmlType="submit" loading={loading}>
                      Withdraw Content
                    </Button>
                  )}
                  {canRetry && content && content.retryCount < content.maxRetries && (
                    <Button onClick={handleRetry} loading={loading}>
                      Retry Publish ({content.retryCount}/{content.maxRetries})
                    </Button>
                  )}
                  <Button onClick={onClose}>Cancel</Button>
                </Space>
              </Form.Item>
            </Form>
          </Space>
        )}
      </Drawer>

      <Modal
        title="Fix Channel Sync Issue"
        open={fixModalVisible}
        onCancel={() => setFixModalVisible(false)}
        footer={null}
      >
        <Form
          onFinish={(values) => selectedChannel && handleFixChannel(selectedChannel.id, values.correction)}
        >
          <Form.Item
            label="Channel"
          >
            <Tag>{selectedChannel ? ChannelLabelMap[selectedChannel.channel] : ''}</Tag>
          </Form.Item>
          <Form.Item
            label="Current Error"
          >
            <Input.TextArea
              value={selectedChannel?.errorMessage || ''}
              disabled
              autoSize={{ minRows: 3, maxRows: 5 }}
            />
          </Form.Item>
          <Form.Item
            name="correction"
            label="Fix Description"
            rules={[{ required: true, message: 'Please enter fix description' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Describe the fix made to resolve this sync issue. This will be recorded for audit."
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                Apply Fix & Reset Retries
              </Button>
              <Button onClick={() => setFixModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ReviewDrawer;
