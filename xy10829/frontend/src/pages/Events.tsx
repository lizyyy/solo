import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Input, Select, DatePicker, Card, Modal, Form, message, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, ExportOutlined, RedoOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTimeoutEvents, createTimeoutEvent, exportEvents, retryEvent } from '../api';
import { EventStatus, TimeoutEvent } from '../types';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Events: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<TimeoutEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState({
    status: undefined as string | undefined,
    ticketId: '',
    startTime: undefined as string | undefined,
    endTime: undefined as string | undefined
  });
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getTimeoutEvents({
        ...filters,
        page: pagination.current,
        pageSize: pagination.pageSize
      });
      setEvents(result.events);
      setTotal(result.total);
    } catch (error) {
      message.error('加载事件列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination, filters]);

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

  const handleRetry = async (record: TimeoutEvent) => {
    try {
      await retryEvent(record.id, '手动重试', 'admin');
      message.success('重试任务已创建');
      loadData();
    } catch (error) {
      message.error('重试失败');
    }
  };

  const columns = [
    {
      title: '事件Key',
      dataIndex: 'eventKey',
      key: 'eventKey',
      width: 200,
      ellipsis: true
    },
    {
      title: '工单ID',
      dataIndex: 'ticketId',
      key: 'ticketId',
      width: 120
    },
    {
      title: 'SLA规则',
      dataIndex: 'slaRuleId',
      key: 'slaRuleId',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '成功', value: 'success' },
        { text: '失败', value: 'failed' },
        { text: '待处理', value: 'pending' },
        { text: '重试中', value: 'retrying' }
      ],
      onFilter: (value: any, record: TimeoutEvent) => record.status === String(value),
      render: (status: EventStatus) => getStatusTag(status)
    },
    {
      title: '重试次数',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 100,
      render: (count: number, record: TimeoutEvent) => `${count}/${record.maxRetries}`
    },
    {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      key: 'triggeredAt',
      width: 180,
      sorter: (a: TimeoutEvent, b: TimeoutEvent) => new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime(),
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: '下次重试',
      dataIndex: 'nextRetryAt',
      key: 'nextRetryAt',
      width: 180,
      render: (time?: string) => time ? new Date(time).toLocaleString() : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: TimeoutEvent) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate(`/events/${record.id}`)}>
            详情
          </Button>
          {record.status !== EventStatus.SUCCESS && (
            <Popconfirm
              title="确认重试"
              description="确定要手动重试这个事件吗？"
              onConfirm={() => handleRetry(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<RedoOutlined />}>
                重试
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const handleCreateEvent = async (values: any) => {
    try {
      await createTimeoutEvent({
        ticketId: values.ticketId,
        slaRuleId: values.slaRuleId,
        eventKey: values.eventKey,
        ticketData: {
          title: values.title,
          content: values.content,
          priority: values.priority
        }
      });
      message.success('事件创建成功');
      setIsModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error: any) {
      if (error.response?.status === 409) {
        message.error('该事件Key已存在');
      } else {
        message.error('创建事件失败');
      }
    }
  };

  const handleTableChange = (paginationInfo: any) => {
    setPagination({
      current: paginationInfo.current,
      pageSize: paginationInfo.pageSize
    });
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>超时事件</h2>
        <Space>
          <Button icon={<ExportOutlined />} onClick={() => exportEvents(filters)}>
            导出
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
            创建事件
          </Button>
        </Space>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索工单ID"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={filters.ticketId}
            onChange={(e) => setFilters({ ...filters, ticketId: e.target.value })}
            onPressEnter={() => setPagination({ ...pagination, current: 1 })}
          />
          <Select
            placeholder="状态筛选"
            style={{ width: 150 }}
            allowClear
            value={filters.status}
            onChange={(value) => {
              setFilters({ ...filters, status: value });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Option value="success">成功</Option>
            <Option value="failed">失败</Option>
            <Option value="pending">待处理</Option>
            <Option value="retrying">重试中</Option>
          </Select>
          <RangePicker
            showTime
            style={{ width: 350 }}
            placeholder={['开始时间', '结束时间']}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setFilters({
                  ...filters,
                  startTime: dates[0].toISOString(),
                  endTime: dates[1].toISOString()
                });
              } else {
                setFilters({
                  ...filters,
                  startTime: undefined,
                  endTime: undefined
                });
              }
              setPagination({ ...pagination, current: 1 });
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={events}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`
        }}
        onChange={handleTableChange}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="创建超时事件"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateEvent}>
          <Form.Item
            name="eventKey"
            label="事件Key"
            rules={[{ required: true, message: '请输入事件Key' }]}
          >
            <Input placeholder="例如: TICKET-001-SLA1" />
          </Form.Item>
          <Form.Item
            name="ticketId"
            label="工单ID"
            rules={[{ required: true, message: '请输入工单ID' }]}
          >
            <Input placeholder="工单编号" />
          </Form.Item>
          <Form.Item
            name="slaRuleId"
            label="SLA规则"
            rules={[{ required: true, message: '请选择SLA规则' }]}
          >
            <Select placeholder="选择SLA规则">
              <Option value="rule-1">标准SLA</Option>
              <Option value="rule-2">紧急SLA</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="title"
            label="工单标题"
            rules={[{ required: true, message: '请输入工单标题' }]}
          >
            <Input placeholder="工单标题" />
          </Form.Item>
          <Form.Item
            name="content"
            label="工单内容"
          >
            <Input.TextArea rows={3} placeholder="工单详细内容" />
          </Form.Item>
          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select placeholder="选择优先级">
              <Option value="low">低</Option>
              <Option value="normal">普通</Option>
              <Option value="high">高</Option>
              <Option value="urgent">紧急</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Events;
