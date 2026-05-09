import { useState } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Modal, Form, message, Tooltip, Typography } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTickets, useCreateTicket, TicketListParams } from '@/api/tickets.api';
import { TicketStatus, TicketPriority, CreateTicketDto } from '@/types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

const STATUS_MAP: Record<TicketStatus, { label: string; color: string }> = {
  [TicketStatus.OPEN]: { label: '待处理', color: 'blue' },
  [TicketStatus.IN_PROGRESS]: { label: '处理中', color: 'orange' },
  [TicketStatus.PENDING_FOLLOWUP]: { label: '待跟进', color: 'warning' },
  [TicketStatus.COMPLETED]: { label: '已完成', color: 'success' },
  [TicketStatus.CLOSED]: { label: '已关闭', color: 'default' },
  [TicketStatus.CANCELLED]: { label: '已取消', color: 'error' },
};

const PRIORITY_MAP: Record<TicketPriority, { label: string; color: string }> = {
  [TicketPriority.LOW]: { label: '低', color: 'default' },
  [TicketPriority.NORMAL]: { label: '中', color: 'blue' },
  [TicketPriority.HIGH]: { label: '高', color: 'orange' },
  [TicketPriority.URGENT]: { label: '紧急', color: 'red' },
};

export function TicketsPage() {
  const [filters, setFilters] = useState<TicketListParams>({
    page: 1,
    pageSize: 10,
  });
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm<CreateTicketDto>();
  const navigate = useNavigate();

  const { data, isLoading } = useTickets(filters);
  const createTicketMutation = useCreateTicket();

  const columns = [
    {
      title: '工单号',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => (
        <Tooltip title={id}>
          <span style={{ fontFamily: 'monospace' }}>{id.substring(0, 8)}...</span>
        </Tooltip>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '客户',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: TicketStatus) => {
        const info = STATUS_MAP[status] || STATUS_MAP[TicketStatus.OPEN];
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: TicketPriority) => {
        const info = PRIORITY_MAP[priority] || PRIORITY_MAP[TicketPriority.NORMAL];
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 60,
      render: (version: number) => `v${version}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record: { id: string }) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/tickets/${record.id}`)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`/tickets/${record.id}`)}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  const handleCreateTicket = async (values: CreateTicketDto) => {
    try {
      await createTicketMutation.mutateAsync(values);
      message.success('工单创建成功');
      setIsCreateModalVisible(false);
      createForm.resetFields();
    } catch (error) {
      message.error('创建工单失败');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>工单管理</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateModalVisible(true)}
        >
          新建工单
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Search
            placeholder="搜索工单标题或客户"
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 300 }}
            onSearch={(value) => setFilters({ ...filters, search: value || undefined, page: 1 })}
          />
          <Select
            placeholder="选择状态"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => setFilters({ ...filters, status: value ? [value] : undefined, page: 1 })}
          >
            {Object.entries(STATUS_MAP).map(([key, { label }]) => (
              <Option key={key} value={key}>{label}</Option>
            ))}
          </Select>
          <Select
            placeholder="选择优先级"
            allowClear
            style={{ width: 120 }}
            onChange={(value) => setFilters({ ...filters, priority: value ? [value] : undefined, page: 1 })}
          >
            {Object.entries(PRIORITY_MAP).map(([key, { label }]) => (
              <Option key={key} value={key}>{label}</Option>
            ))}
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={data?.tickets}
          loading={isLoading}
          rowKey="id"
          pagination={{
            current: filters.page,
            pageSize: filters.pageSize,
            total: data?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setFilters({ ...filters, page, pageSize }),
          }}
        />
      </Card>

      <Modal
        title="新建工单"
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateTicket}
        >
          <Form.Item
            name="title"
            label="工单标题"
            rules={[{ required: true, message: '请输入工单标题' }]}
          >
            <Input placeholder="请输入工单标题" />
          </Form.Item>

          <Form.Item
            name="customerId"
            label="客户ID"
            rules={[{ required: true, message: '请输入客户ID' }]}
          >
            <Input placeholder="请输入客户ID" />
          </Form.Item>

          <Form.Item name="customerName" label="客户姓名">
            <Input placeholder="请输入客户姓名" />
          </Form.Item>

          <Form.Item name="customerPhone" label="客户电话">
            <Input placeholder="请输入客户电话" />
          </Form.Item>

          <Form.Item name="category" label="分类">
            <Input placeholder="工单分类" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} placeholder="详细描述" />
          </Form.Item>

          <Form.Item name="priority" label="优先级" initialValue={TicketPriority.NORMAL}>
            <Select>
              {Object.entries(PRIORITY_MAP).map(([key, { label }]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createTicketMutation.isPending}>
                创建
              </Button>
              <Button onClick={() => setIsCreateModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default TicketsPage;
