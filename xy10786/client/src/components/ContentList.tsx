import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, message, Typography } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { contentApi } from '../services/api';
import { ContentItem, ContentStatus, StatusLabelMap, StatusColorMap, ChannelType, ChannelLabelMap, ReviewAction } from '../types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import ReviewDrawer from './ReviewDrawer';
import TimelineView from './TimelineView';

const { TextArea } = Input;
const { Option } = Select;
const { Title } = Typography;

const ContentList: React.FC = () => {
  const [list, setList] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [reviewDrawerVisible, setReviewDrawerVisible] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [viewTimeline, setViewTimeline] = useState(false);
  
  const [form] = Form.useForm();

  useEffect(() => {
    loadList();
  }, [page, pageSize]);

  const loadList = async () => {
    setLoading(true);
    try {
      const result = await contentApi.list({ page, pageSize });
      if (result.success) {
        setList(result.data?.list || []);
        setTotal(result.data?.total || 0);
      } else {
        message.error(result.message || 'Failed to load content list');
      }
    } catch (error) {
      console.error('Failed to load content list:', error);
      message.error('Failed to load content list');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      const result = await contentApi.create({
        title: values.title,
        content: values.content,
        author: 'admin',
        scheduledAt: values.scheduledAt?.toISOString(),
        channels: values.channels
      });

      if (result.success || result.code === 202) {
        message.success(result.message || 'Content created successfully');
        setCreateModalVisible(false);
        form.resetFields();
        loadList();
      } else {
        message.error(result.message || 'Failed to create content');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to create content');
    }
  };

  const handleSubmitReview = async (id: string) => {
    try {
      const result = await contentApi.submitForReview(id, 'admin');
      if (result.success || result.code === 202) {
        message.success(result.message || 'Submitted for review successfully');
        loadList();
      } else {
        message.error(result.message || 'Failed to submit for review');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to submit for review');
    }
  };

  const handlePublishNow = async (id: string) => {
    try {
      const result = await contentApi.publishNow(id);
      if (result.success) {
        message.success(result.message || 'Publish initiated');
        loadList();
      } else {
        message.error(result.message || 'Failed to initiate publish');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to initiate publish');
    }
  };

  const columns: ColumnsType<ContentItem> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (text, record) => (
        <a onClick={() => { setSelectedContent(record); setViewTimeline(true); }}>{text}</a>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: Object.values(ContentStatus).map(status => ({
        text: StatusLabelMap[status],
        value: status
      })),
      onFilter: (value, record) => record.status === value,
      render: (status: ContentStatus) => (
        <Tag color={StatusColorMap[status]}>{StatusLabelMap[status]}</Tag>
      )
    },
    {
      title: 'Channels',
      dataIndex: 'channels',
      key: 'channels',
      width: 200,
      render: (channels) => (
        <Space wrap size={[0, 4]}>
          {channels?.map((ch: any) => (
            <Tag key={ch.channel} color={StatusColorMap[ch.status]} style={{ marginBottom: 4 }}>
              {ChannelLabelMap[ch.channel]}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: 'Scheduled At',
      dataIndex: 'scheduledAt',
      key: 'scheduledAt',
      width: 160,
      render: (date: string | null) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: 'Author',
      dataIndex: 'author',
      key: 'author',
      width: 100
    },
    {
      title: 'Retry Count',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 100,
      render: (count: number, record) => `${count}/${record.maxRetries}`
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setSelectedContent(record); setViewTimeline(true); }}
          >
            Details
          </Button>
          
          {record.status === ContentStatus.DRAFT && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleSubmitReview(record.id)}
            >
              Submit for Review
            </Button>
          )}

          {(record.status === ContentStatus.APPROVED || 
            record.status === ContentStatus.SCHEDULED) && (
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined />}
              onClick={() => handlePublishNow(record.id)}
            >
              Publish Now
            </Button>
          )}
          
          {(record.status === ContentStatus.PENDING_REVIEW ||
            record.status === ContentStatus.NEEDS_REVIEW ||
            record.status === ContentStatus.FAILED ||
            record.status === ContentStatus.RETRYABLE ||
            record.status === ContentStatus.BLOCKED) && (
            <Button
              type="link"
              size="small"
              danger={record.status === ContentStatus.FAILED || record.status === ContentStatus.BLOCKED}
              onClick={() => { setSelectedContent(record); setReviewDrawerVisible(true); }}
            >
              {record.status === ContentStatus.NEEDS_REVIEW || 
               record.status === ContentStatus.FAILED || 
               record.status === ContentStatus.RETRYABLE
                ? 'Review / Retry'
                : 'Review'}
            </Button>
          )}
        </Space>
      )
    }
  ];

  if (viewTimeline && selectedContent) {
    return (
      <div style={{ padding: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Button onClick={() => setViewTimeline(false)}>Back to List</Button>
          </div>
          <TimelineView 
            contentId={selectedContent.id} 
          />
        </Space>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>Content Management</Title>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                New Content
              </Button>
              <Button onClick={loadList}>Refresh</Button>
            </Space>
          </div>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `Total ${total} items`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          }
        }}
        scroll={{ x: 1300 }}
      />

      <Modal
        title="Create New Content"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter title' }]}
          >
            <Input placeholder="Enter content title" />
          </Form.Item>

          <Form.Item
            name="content"
            label="Content"
            rules={[{ required: true, message: 'Please enter content' }]}
          >
            <TextArea rows={8} placeholder="Enter content details" />
          </Form.Item>

          <Form.Item
            name="channels"
            label="Publish Channels"
          >
            <Select mode="multiple" placeholder="Select publish channels">
              {Object.values(ChannelType).map(channel => (
                <Option key={channel} value={channel}>
                  {ChannelLabelMap[channel]}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="scheduledAt"
            label="Scheduled Publish Time (Leave empty for draft)"
          >
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="Select publish time"
              minuteStep={5}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <ReviewDrawer
        visible={reviewDrawerVisible}
        content={selectedContent}
        onClose={() => {
          setReviewDrawerVisible(false);
          setSelectedContent(null);
        }}
        onSuccess={loadList}
      />
    </div>
  );
};

export default ContentList;
