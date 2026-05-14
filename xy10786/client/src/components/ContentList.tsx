import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { contentApi } from '../services/api';
import { ContentItem, ContentStatus, StatusLabelMap, StatusColorMap, ChannelType, ChannelLabelMap } from '../types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import ReviewDrawer from './ReviewDrawer';
import TimelineView from './TimelineView';

const { TextArea } = Input;
const { Option } = Select;

const ContentList: React.FC = () => {
  const [list, setList] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [reviewDrawerVisible, setReviewDrawerVisible] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [viewTimeline, setViewTimeline] = useState(false);
  
  const [form] = Form.useForm();

  useEffect(() => {
    loadList();
  }, [page, pageSize, statusFilter]);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await contentApi.list({ status: statusFilter, page, pageSize });
      if (res.data.success) {
        setList(res.data.data.list);
        setTotal(res.data.data.total);
      }
    } catch (error) {
      console.error('Failed to load content list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      const res = await contentApi.create({
        title: values.title,
        content: values.content,
        author: 'admin',
        scheduledAt: values.scheduledAt?.toISOString(),
        channels: values.channels
      });

      if (res.data.success) {
        message.success('内容创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        loadList();
      } else {
        message.error(res.data.message || '创建失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  const handleSubmitReview = async (id: string) => {
    try {
      const res = await contentApi.submitForReview(id, 'admin');
      if (res.data.success) {
        message.success('已提交审核');
        loadList();
      } else {
        message.error(res.data.message || '提交失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '提交失败');
    }
  };

  const handleOpenReview = (content: ContentItem) => {
    setSelectedContent(content);
    setReviewDrawerVisible(true);
  };

  const handleViewTimeline = (content: ContentItem) => {
    setSelectedContent(content);
    setViewTimeline(true);
  };

  const columns: ColumnsType<ContentItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (text, record) => (
        <a onClick={() => handleViewTimeline(record)}>{text}</a>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
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
      title: '发布渠道',
      dataIndex: 'channels',
      key: 'channels',
      width: 200,
      render: (channels) => (
        <Space wrap size={[0, 4]}>
          {channels?.map((ch: any) => (
            <Tag key={ch.channel} color="blue" style={{ marginBottom: 4 }}>
              {ChannelLabelMap[ch.channel]}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: '计划发布',
      dataIndex: 'scheduledAt',
      key: 'scheduledAt',
      width: 160,
      render: (date: string | null) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 80
    },
    {
      title: '重试次数',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 80,
      render: (count: number, record) => `${count}/${record.maxRetries}`
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewTimeline(record)}
          >
            详情
          </Button>
          
          {record.status === ContentStatus.DRAFT && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleSubmitReview(record.id)}
            >
              提交审核
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
              onClick={() => handleOpenReview(record)}
            >
              {record.status === ContentStatus.NEEDS_REVIEW || record.status === ContentStatus.FAILED || record.status === ContentStatus.RETRYABLE
                ? '复核'
                : '审核'}
            </Button>
          )}
        </Space>
      )
    }
  ];

  if (viewTimeline && selectedContent) {
    return (
      <div style={{ padding: 24 }}>
        <TimelineView 
          contentId={selectedContent.id} 
          onBack={() => setViewTimeline(false)} 
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建内容
          </Button>
          <Button onClick={loadList}>刷新</Button>
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
          showTotal: (total) => `共 ${total} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          }
        }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="新建内容"
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
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入内容标题" />
          </Form.Item>

          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea rows={8} placeholder="请输入内容详情" />
          </Form.Item>

          <Form.Item
            name="channels"
            label="发布渠道"
          >
            <Select mode="multiple" placeholder="请选择发布渠道">
              {Object.values(ChannelType).map(channel => (
                <Option key={channel} value={channel}>
                  {ChannelLabelMap[channel]}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="scheduledAt"
            label="计划发布时间（不填则保存为草稿）"
          >
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="选择发布时间"
              minuteStep={5}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>
                取消
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
