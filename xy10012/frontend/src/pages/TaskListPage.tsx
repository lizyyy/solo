import { useEffect, useState, useMemo } from 'react';
import {
  Space,
  Table,
  Button,
  Select,
  Input,
  Tag,
  Tooltip,
  Modal,
  Form,
  DatePicker,
  InputNumber,
  message,
  Popconfirm,
  Dropdown,
  Card,
  Pagination,
} from 'antd';
import {
  PlusOutlined,
  ExportOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EyeOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { taskApi, Task } from '../api';
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  getStatusInfo,
  getPriorityInfo,
  formatDate,
  downloadBlob,
} from '../utils/constants';

const { RangePicker } = DatePicker;

export default function TaskListPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    tasks,
    pagination,
    loading,
    filters,
    fetchTasks,
    setFilters,
    deleteTask,
  } = useTaskStore();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [exportRange, setExportRange] = useState<[Dayjs, Dayjs] | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [filters, fetchTasks]);

  const handleTableChange = (page: number, pageSize: number) => {
    fetchTasks({ page, pageSize });
  };

  const handleCreateTask = async (values: any) => {
    try {
      await createForm.validateFields();

      const taskData = {
        ...values,
        dueDate: values.dueDate?.toISOString(),
        customerId: 'mock-customer-id',
      };

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(taskData),
      });

      if (response.ok) {
        const data = await response.json();
        message.success(data.isDuplicate ? '任务已存在，已定位到该任务' : '创建任务成功');
        setIsCreateModalOpen(false);
        createForm.resetFields();
        fetchTasks();
      } else {
        const error = await response.json();
        message.error(error.message || '创建任务失败');
      }
    } catch (error: any) {
      message.error(error.message || '创建任务失败');
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      await deleteTask(task.id, '用户手动删除');
      message.success('删除成功');
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleExport = async (format: 'excel' | 'markdown' | 'pdf') => {
    try {
      const params: any = {};
      if (filters.status?.length) params.status = filters.status;
      if (filters.priority?.length) params.priority = filters.priority;
      if (filters.assigneeId) params.assigneeId = filters.assigneeId;
      if (exportRange) {
        params.startDate = exportRange[0].toISOString();
        params.endDate = exportRange[1].toISOString();
      }

      const blob = await taskApi.export(format, params);
      const ext = format === 'excel' ? 'xlsx' : format;
      downloadBlob(blob, `tasks_${Date.now()}.${ext}`);
      message.success('导出成功');
    } catch (error: any) {
      message.error(error.message || '导出失败');
    }
  };

  const columns = useMemo(
    () => [
      {
        title: '任务标题',
        dataIndex: 'title',
        key: 'title',
        render: (text: string, record: Task) => (
          <a onClick={() => navigate(`/tasks/${record.id}`)}>{text}</a>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: string) => {
          const info = getStatusInfo(status);
          return <Tag color={info.color}>{info.label}</Tag>;
        },
        filters: STATUS_OPTIONS.map((opt) => ({
          text: opt.label,
          value: opt.value,
        })),
        onFilter: (value: string | number | boolean, record: Task) =>
          record.status === value,
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        key: 'priority',
        width: 100,
        render: (priority: string) => {
          const info = getPriorityInfo(priority);
          return <Tag color={info.color}>{info.label}</Tag>;
        },
        filters: PRIORITY_OPTIONS.map((opt) => ({
          text: opt.label,
          value: opt.value,
        })),
        onFilter: (value: string | number | boolean, record: Task) =>
          record.priority === value,
      },
      {
        title: '客户',
        dataIndex: ['customer', 'name'],
        key: 'customer',
        width: 120,
        render: (name: string) => name || '-',
      },
      {
        title: '订单号',
        dataIndex: 'orderNumber',
        key: 'orderNumber',
        width: 150,
        render: (orderNumber: string) => orderNumber || '-',
      },
      {
        title: '负责人',
        dataIndex: ['assignee', 'name'],
        key: 'assignee',
        width: 100,
        render: (name: string) => name || '未分配',
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (date: string) => formatDate(date),
      },
      {
        title: '截止日期',
        dataIndex: 'dueDate',
        key: 'dueDate',
        width: 180,
        render: (date: string) => formatDate(date),
      },
      {
        title: '操作',
        key: 'action',
        width: 160,
        render: (_: any, record: Task) => (
          <Space size="small">
            <Tooltip title="查看详情">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/tasks/${record.id}`)}
              />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => navigate(`/tasks/${record.id}`)}
              />
            </Tooltip>
            <Tooltip title="删除">
              <Popconfirm
                title="确认删除此任务？"
                description="删除后可以在审计日志中查看"
                onConfirm={() => handleDeleteTask(record)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          </Space>
        ),
      },
    ],
    [navigate, deleteTask]
  );

  const exportMenu = {
    items: [
      {
        key: 'excel',
        icon: <DownloadOutlined />,
        label: '导出 Excel',
        onClick: () => handleExport('excel'),
      },
      {
        key: 'markdown',
        icon: <DownloadOutlined />,
        label: '导出 Markdown',
        onClick: () => handleExport('markdown'),
      },
      {
        key: 'pdf',
        icon: <DownloadOutlined />,
        label: '导出 PDF',
        onClick: () => handleExport('pdf'),
      },
    ],
  };

  return (
    <div>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Select
                mode="multiple"
                placeholder="筛选状态"
                style={{ width: 200 }}
                value={filters.status}
                onChange={(value) => setFilters({ status: value })}
                options={STATUS_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
              <Select
                mode="multiple"
                placeholder="筛选优先级"
                style={{ width: 180 }}
                value={filters.priority}
                onChange={(value) => setFilters({ priority: value })}
                options={PRIORITY_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
              <Input.Search
                placeholder="搜索任务..."
                style={{ width: 250 }}
                prefix={<SearchOutlined />}
                onSearch={(value) => setFilters({ search: value || undefined })}
                allowClear
              />
            </Space>

            <Space>
              <RangePicker
                value={exportRange}
                onChange={setExportRange}
                placeholder={['开始日期', '结束日期']}
              />
              <Dropdown menu={exportMenu}>
                <Button icon={<ExportOutlined />}>
                  导出
                </Button>
              </Dropdown>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsCreateModalOpen(true)}
              >
                新建任务
              </Button>
            </Space>
          </Space>

          <Table
            columns={columns}
            dataSource={tasks}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="middle"
          />

          <div style={{ textAlign: 'center' }}>
            <Pagination
              current={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              showSizeChanger
              showQuickJumper
              showTotal={(total) => `共 ${total} 条记录`}
              onChange={handleTableChange}
            />
          </div>
        </Space>
      </Card>

      <Modal
        title="新建任务"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateTask}
        >
          <Form.Item
            name="title"
            label="任务标题"
            rules={[{ required: true, message: '请输入任务标题' }]}
          >
            <Input placeholder="例如：订单补发 - 商品A" />
          </Form.Item>

          <Form.Item name="description" label="任务描述">
            <Input.TextArea rows={3} placeholder="详细描述任务内容..." />
          </Form.Item>

          <Space style={{ width: '100%' }}>
            <Form.Item
              name="status"
              label="状态"
              style={{ flex: 1 }}
              initialValue="PENDING"
            >
              <Select
                options={STATUS_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="priority"
              label="优先级"
              style={{ flex: 1 }}
              initialValue="MEDIUM"
            >
              <Select
                options={PRIORITY_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }}>
            <Form.Item name="orderNumber" label="订单号" style={{ flex: 1 }}>
              <Input placeholder="请输入订单号" />
            </Form.Item>

            <Form.Item name="trackingNumber" label="快递单号" style={{ flex: 1 }}>
              <Input placeholder="请输入快递单号" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }}>
            <Form.Item name="refundAmount" label="退款金额 (元)" style={{ flex: 1 }}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="dueDate" label="截止日期" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))} />
            </Form.Item>
          </Space>

          <Form.Item>
            <Space style={{ float: 'right' }}>
              <Button onClick={() => setIsCreateModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}