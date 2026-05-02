import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Divider,
  List,
  Input,
  Select,
  Modal,
  Timeline,
  message,
  Row,
  Col,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  MessageOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  TicketWithDetails,
  Comment,
  StatusHistory,
  TicketStatus,
  TicketPriority,
  STATUS_LABELS,
  PRIORITY_LABELS,
  UpdateStatusRequest,
} from '../types';
import { ticketApi } from '../services/api';

const { TextArea } = Input;

const STATUS_COLOR_MAP: Record<TicketStatus, string> = {
  [TicketStatus.PENDING]: 'orange',
  [TicketStatus.IN_PROGRESS]: 'processing',
  [TicketStatus.PENDING_CONFIRMATION]: 'blue',
  [TicketStatus.CLOSED]: 'default',
};

const PRIORITY_COLOR_MAP: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'default',
  [TicketPriority.MEDIUM]: 'blue',
  [TicketPriority.HIGH]: 'orange',
  [TicketPriority.URGENT]: 'red',
};

const STATUS_TRANSITIONS: Record<TicketStatus, { value: TicketStatus; label: string }[]> = {
  [TicketStatus.PENDING]: [
    { value: TicketStatus.IN_PROGRESS, label: STATUS_LABELS[TicketStatus.IN_PROGRESS] },
  ],
  [TicketStatus.IN_PROGRESS]: [
    { value: TicketStatus.PENDING_CONFIRMATION, label: STATUS_LABELS[TicketStatus.PENDING_CONFIRMATION] },
  ],
  [TicketStatus.PENDING_CONFIRMATION]: [
    { value: TicketStatus.IN_PROGRESS, label: STATUS_LABELS[TicketStatus.IN_PROGRESS] },
    { value: TicketStatus.CLOSED, label: STATUS_LABELS[TicketStatus.CLOSED] },
  ],
  [TicketStatus.CLOSED]: [],
};

const TicketDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [newStatus, setNewStatus] = useState<TicketStatus | null>(null);
  const [statusRemark, setStatusRemark] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const ticketId = id ? parseInt(id, 10) : 0;

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const data = await ticketApi.getTicket(ticketId);
      setTicket(data);
    } catch (error) {
      message.error('获取工单详情失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleUpdateStatus = async () => {
    if (!ticket || !newStatus) return;

    try {
      const request: UpdateStatusRequest = {
        newStatus,
        remark: statusRemark,
        changedBy: commentAuthor || '系统',
      };
      await ticketApi.updateStatus(ticket.id, request);
      message.success('状态更新成功');
      setStatusModalVisible(false);
      setNewStatus(null);
      setStatusRemark('');
      fetchTicket();
    } catch (error: any) {
      message.error(error.message || '状态更新失败');
    }
  };

  const handleAddComment = async () => {
    if (!ticket) return;
    if (!commentAuthor.trim()) {
      message.warning('请输入评论人');
      return;
    }
    if (!commentContent.trim()) {
      message.warning('请输入评论内容');
      return;
    }

    setSubmittingComment(true);
    try {
      await ticketApi.addComment(ticket.id, {
        author: commentAuthor.trim(),
        content: commentContent.trim(),
      });
      message.success('评论添加成功');
      setCommentContent('');
      fetchTicket();
    } catch (error) {
      message.error('添加评论失败');
    } finally {
      setSubmittingComment(false);
    }
  };

  const renderStatusTimeline = (history: StatusHistory[]) => {
    return (
      <Timeline
        items={history.map((h, index) => ({
          key: h.id,
          color: h.newStatus === TicketStatus.CLOSED ? 'green' : 'blue',
          dot: index === 0 ? <ClockCircleOutlined style={{ fontSize: '16px' }} /> : undefined,
          children: (
            <div className="timeline-content">
              <h4>
                {h.oldStatus ? (
                  <>
                    <Tag color={STATUS_COLOR_MAP[h.oldStatus]}>{STATUS_LABELS[h.oldStatus]}</Tag>
                    <span style={{ margin: '0 8px' }}>→</span>
                  </>
                ) : null}
                <Tag color={STATUS_COLOR_MAP[h.newStatus]}>{STATUS_LABELS[h.newStatus]}</Tag>
              </h4>
              {h.remark && <p>备注: {h.remark}</p>}
              <p>操作人: {h.changedBy}</p>
              <p>时间: {dayjs(h.changedAt).format('YYYY-MM-DD HH:mm:ss')}</p>
            </div>
          ),
        }))}
      />
    );
  };

  const renderComments = (comments: Comment[]) => {
    return (
      <List
        dataSource={comments}
        locale={{ emptyText: '暂无评论' }}
        renderItem={(comment) => (
          <List.Item>
            <List.Item.Meta
              avatar={<MessageOutlined style={{ fontSize: '24px', color: '#1890ff' }} />}
              title={
                <Space>
                  <span style={{ fontWeight: 'bold' }}>{comment.author}</span>
                  <span style={{ color: '#999', fontSize: '12px' }}>
                    {dayjs(comment.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                  </span>
                </Space>
              }
              description={<div style={{ whiteSpace: 'pre-wrap' }}>{comment.content}</div>}
            />
          </List.Item>
        )}
      />
    );
  };

  if (!ticket) {
    return (
      <Card loading={loading}>
        加载中...
      </Card>
    );
  }

  const isClosed = ticket.status === TicketStatus.CLOSED;
  const availableTransitions = STATUS_TRANSITIONS[ticket.status] || [];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            返回列表
          </Button>
          {!isClosed && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/edit/${ticket.id}`)}
            >
              编辑工单
            </Button>
          )}
          {availableTransitions.length > 0 && (
            <Button onClick={() => setStatusModalVisible(true)}>
              更新状态
            </Button>
          )}
        </Space>
      </Card>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="工单信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="标题" span={2}>
                {ticket.title}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLOR_MAP[ticket.status]}>
                  {STATUS_LABELS[ticket.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={PRIORITY_COLOR_MAP[ticket.priority]}>
                  {PRIORITY_LABELS[ticket.priority]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="客户名称">
                {ticket.customerName}
              </Descriptions.Item>
              <Descriptions.Item label="客户联系方式">
                {ticket.customerContact}
              </Descriptions.Item>
              <Descriptions.Item label="负责人">
                {ticket.assignee || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="标签">
                {ticket.tags
                  ? ticket.tags.split(',').map((tag, index) => (
                      <Tag key={index} style={{ margin: 2 }}>
                        {tag.trim()}
                      </Tag>
                    ))
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(ticket.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间" span={2}>
                {dayjs(ticket.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="问题描述" span={2}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</div>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="评论区" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                <Input
                  placeholder="评论人"
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                  style={{ width: 150 }}
                />
                <TextArea
                  placeholder="输入评论内容..."
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  style={{ minHeight: 80 }}
                />
              </Space.Compact>
              <Button
                type="primary"
                onClick={handleAddComment}
                loading={submittingComment}
              >
                添加评论
              </Button>
            </div>
            <Divider />
            {renderComments(ticket.comments)}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="状态时间线">
            {ticket.statusHistory.length > 0 ? (
              renderStatusTimeline(ticket.statusHistory)
            ) : (
              <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                暂无状态记录
              </p>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="更新状态"
        open={statusModalVisible}
        onOk={handleUpdateStatus}
        onCancel={() => {
          setStatusModalVisible(false);
          setNewStatus(null);
          setStatusRemark('');
        }}
        okText="确认"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8 }}>
            当前状态:
            <Tag color={STATUS_COLOR_MAP[ticket.status]} style={{ marginLeft: 8 }}>
              {STATUS_LABELS[ticket.status]}
            </Tag>
          </p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8 }}>目标状态:</p>
          <Select
            placeholder="选择目标状态"
            style={{ width: '100%' }}
            value={newStatus}
            onChange={(value) => setNewStatus(value)}
            options={availableTransitions}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8 }}>备注 (可选):</p>
          <TextArea
            placeholder="输入状态变更备注..."
            value={statusRemark}
            onChange={(e) => setStatusRemark(e.target.value)}
            rows={3}
          />
        </div>
        <div>
          <p style={{ marginBottom: 8 }}>操作人:</p>
          <Input
            placeholder="请输入操作人姓名"
            value={commentAuthor}
            onChange={(e) => setCommentAuthor(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default TicketDetail;
