import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Button, Space, Table, Tag, message, Collapse } from 'antd';
import { ArrowLeftOutlined, SyncOutlined, RedoOutlined } from '@ant-design/icons';
import { getTimeoutEvent, getResponseSummaries, retryEvent } from '../api';
import { EventStatus, TimeoutEvent, ResponseSummary } from '../types';

const { Panel } = Collapse;

const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<TimeoutEvent | null>(null);
  const [responses, setResponses] = useState<ResponseSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [eventData, responsesData] = await Promise.all([
        getTimeoutEvent(id),
        getResponseSummaries(id)
      ]);
      setEvent(eventData);
      setResponses(responsesData);
    } catch (error) {
      message.error('加载事件详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleRetry = async () => {
    if (!id) return;
    try {
      await retryEvent(id, '手动重试', 'admin');
      message.success('重试任务已创建');
      loadData();
    } catch (error) {
      message.error('重试失败');
    }
  };

  const getStatusTag = (status: EventStatus) => {
    const statusMap: Record<EventStatus, { color: string; text: string }> = {
      [EventStatus.SUCCESS]: { color: 'success', text: '成功' },
      [EventStatus.FAILED]: { color: 'error', text: '失败' },
      [EventStatus.PENDING]: { color: 'default', text: '待处理' },
      [EventStatus.PROCESSING]: { color: 'processing', text: '处理中' },
      [EventStatus.RETRYING]: { color: 'warning', text: '重试中' },
      [EventStatus.CANCELLED]: { color: 'default', text: '已取消' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const responseColumns = [
    {
      title: '目标ID',
      dataIndex: 'targetId',
      key: 'targetId',
      width: 150
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: EventStatus) => getStatusTag(status)
    },
    {
      title: 'HTTP状态码',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 120,
      render: (code?: number) => code || '-'
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 100,
      render: (ms: number) => `${ms}ms`
    },
    {
      title: '请求时间',
      dataIndex: 'requestedAt',
      key: 'requestedAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString()
    }
  ];

  if (!event) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/events')}>
            返回列表
          </Button>
          <h2 style={{ margin: 0 }}>事件详情</h2>
        </Space>
        <Space>
          <Button icon={<SyncOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          {event.status !== EventStatus.SUCCESS && (
            <Button type="primary" danger icon={<RedoOutlined />} onClick={handleRetry}>
              手动重试
            </Button>
          )}
        </Space>
      </Space>

      <Card loading={loading} style={{ marginBottom: 16 }}>
        <Descriptions title="基本信息" bordered column={2}>
          <Descriptions.Item label="事件ID" span={1}>{event.id}</Descriptions.Item>
          <Descriptions.Item label="事件Key" span={1}>{event.eventKey}</Descriptions.Item>
          <Descriptions.Item label="工单ID" span={1}>{event.ticketId}</Descriptions.Item>
          <Descriptions.Item label="SLA规则" span={1}>{event.slaRuleId}</Descriptions.Item>
          <Descriptions.Item label="状态" span={1}>{getStatusTag(event.status)}</Descriptions.Item>
          <Descriptions.Item label="重试次数" span={1}>{event.retryCount} / {event.maxRetries}</Descriptions.Item>
          <Descriptions.Item label="触发时间" span={1}>{new Date(event.triggeredAt).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="下次重试" span={1}>
            {event.nextRetryAt ? new Date(event.nextRetryAt).toLocaleString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间" span={1}>{new Date(event.createdAt).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="更新时间" span={1}>{new Date(event.updatedAt).toLocaleString()}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="回调响应记录" loading={loading}>
        <Table
          columns={responseColumns}
          dataSource={responses}
          rowKey="id"
          pagination={false}
          expandable={{
            expandedRowRender: (record) => (
              <Collapse defaultActiveKey={['1', '2']}>
                {record.responseBody && (
                  <Panel header="响应内容" key="1">
                    <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
                      {record.responseBody}
                    </pre>
                  </Panel>
                )}
                {record.errorMessage && (
                  <Panel header="错误信息" key="2">
                    <pre style={{ background: '#fff2f0', padding: 12, borderRadius: 4, color: '#ff4d4f' }}>
                      {record.errorMessage}
                    </pre>
                  </Panel>
                )}
              </Collapse>
            )
          }}
        />
      </Card>
    </div>
  );
};

export default EventDetail;
