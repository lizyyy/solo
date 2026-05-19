import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Select,
  Input,
  Tag,
  message,
  Popconfirm,
  Drawer,
  Descriptions,
  DatePicker,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  DownloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { taskApi, environmentApi, datasetApi, rollbackApi } from '../services/api';
import { SeedTask, Environment, DatasetVersion, SeedRecord, RollbackRecord } from '../types';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<SeedTask[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [datasets, setDatasets] = useState<DatasetVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<SeedTask | null>(null);
  const [records, setRecords] = useState<SeedRecord[]>([]);
  const [rollbacks, setRollbacks] = useState<RollbackRecord[]>([]);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: undefined as string | undefined,
    environmentId: undefined as string | undefined,
  });
  const [form] = Form.useForm();

  useEffect(() => {
    loadEnvironmentsAndDatasets();
    loadTasks();
  }, [filters]);

  const loadEnvironmentsAndDatasets = async () => {
    try {
      const [envsData, datasetsData] = await Promise.all([
        environmentApi.getAll(),
        datasetApi.getAll(),
      ]);
      setEnvironments(envsData);
      setDatasets(datasetsData);
    } catch (error) {
      message.error('加载环境和数据集失败');
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const result = await taskApi.getAll(filters);
      setTasks(result.tasks);
      setTotal(result.total);
    } catch (error) {
      message.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (values: any) => {
    try {
      await taskApi.create(values);
      message.success('任务创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadTasks();
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建任务失败');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await taskApi.retry(id);
      message.success('重试任务已提交');
      setTimeout(loadTasks, 1000);
    } catch (error: any) {
      message.error(error.response?.data?.message || '重试失败');
    }
  };

  const handleRollback = async (id: string) => {
    try {
      const reason = `人工回滚 - ${new Date().toLocaleString()}`;
      await taskApi.rollback(id, reason);
      message.success('回滚任务已提交');
      setTimeout(loadTasks, 1000);
    } catch (error: any) {
      message.error(error.response?.data?.message || '回滚失败');
    }
  };

  const handleExport = async (id: string) => {
    try {
      const response = await taskApi.export(id);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `task-report-${id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleViewDetail = async (id: string) => {
    try {
      const result = await taskApi.getById(id);
      setSelectedTask(result.task);
      setRecords(result.records);
      setRollbacks(result.rollbacks);
      setDetailVisible(true);
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const handleReviewRollback = async (rollbackId: string) => {
    try {
      await rollbackApi.review(rollbackId, {
        reviewedBy: 'Admin',
        reviewComment: '已审核通过',
      });
      message.success('审核成功');
      if (selectedTask) {
        handleViewDetail(selectedTask.id);
      }
    } catch (error) {
      message.error('审核失败');
    }
  };

  const columns = [
    {
      title: '环境',
      dataIndex: ['Environment', 'name'],
      key: 'environment',
      width: 120,
    },
    {
      title: '数据集',
      dataIndex: ['Dataset', 'name'],
      key: 'dataset',
      width: 150,
    },
    {
      title: '版本',
      dataIndex: ['Dataset', 'version'],
      key: 'version',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string; status: any }> = {
          pending: { color: 'default', text: '待处理', status: 'default' },
          processing: { color: 'processing', text: '处理中', status: 'processing' },
          success: { color: 'success', text: '成功', status: 'success' },
          failed: { color: 'error', text: '失败', status: 'error' },
          rolling_back: { color: 'warning', text: '回滚中', status: 'warning' },
          rolled_back: { color: 'warning', text: '已回滚', status: 'warning' },
          retrying: { color: 'processing', text: '重试中', status: 'processing' },
        };
        const info = statusMap[status] || { color: 'default', text: status, status: 'default' };
        return <Badge status={info.status} text={info.text} />;
      },
    },
    {
      title: '重试次数',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 100,
    },
    {
      title: '总记录',
      dataIndex: 'totalRecords',
      key: 'totalRecords',
      width: 100,
    },
    {
      title: '成功记录',
      dataIndex: 'successRecords',
      key: 'successRecords',
      width: 100,
    },
    {
      title: '失败记录',
      dataIndex: 'failedRecords',
      key: 'failedRecords',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: SeedTask) => (
        <Space size="small">
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleViewDetail(record.id)}>
            详情
          </Button>
          {['failed', 'rolled_back'].includes(record.status) && record.retryCount < record.maxRetries && (
            <Popconfirm title="确认重试该任务?" onConfirm={() => handleRetry(record.id)}>
              <Button icon={<ReloadOutlined />} size="small" type="primary">
                重试
              </Button>
            </Popconfirm>
          )}
          {['success', 'failed'].includes(record.status) && (
            <Popconfirm title="确认回滚该任务?" onConfirm={() => handleRollback(record.id)}>
              <Button icon={<RollbackOutlined />} size="small" danger>
                回滚
              </Button>
            </Popconfirm>
          )}
          {record.status === 'success' && (
            <Button icon={<DownloadOutlined />} size="small" onClick={() => handleExport(record.id)}>
              导出
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const recordColumns = [
    { title: '记录ID', dataIndex: 'recordId', key: 'recordId' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={status === 'success' ? 'green' : 'red'}>{status}</Tag>,
    },
    { title: '导入时间', dataIndex: 'importedAt', key: 'importedAt', render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-' },
    { title: '回滚时间', dataIndex: 'rolledBackAt', key: 'rolledBackAt', render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-' },
  ];

  const rollbackColumns = [
    { title: '原因', dataIndex: 'reason', key: 'reason' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'orange',
          in_progress: 'blue',
          completed: 'green',
          reviewed: 'green',
          failed: 'red',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    { title: '回滚记录数', dataIndex: 'rolledBackRecords', key: 'rolledBackRecords' },
    { title: '评审人', dataIndex: 'reviewedBy', key: 'reviewedBy', render: (val: string) => val || '-' },
    { title: '完成时间', dataIndex: 'completedAt', key: 'completedAt', render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-' },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: RollbackRecord) =>
        record.status === 'pending' ? (
          <Popconfirm title="确认审核通过?" onConfirm={() => handleReviewRollback(record.id)}>
            <Button type="primary" size="small">
              审核
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>任务管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          创建任务
        </Button>
      </div>

      <div style={{ marginBottom: 16, padding: 16, background: '#fafafa', borderRadius: 8 }}>
        <Space wrap>
          <Select
            placeholder="筛选状态"
            style={{ width: 150 }}
            allowClear
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
          >
            <Select.Option value="pending">待处理</Select.Option>
            <Select.Option value="processing">处理中</Select.Option>
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
            <Select.Option value="rolled_back">已回滚</Select.Option>
          </Select>
          <Select
            placeholder="筛选环境"
            style={{ width: 150 }}
            allowClear
            value={filters.environmentId}
            onChange={(value) => setFilters({ ...filters, environmentId: value, page: 1 })}
          >
            {environments.map((env) => (
              <Select.Option key={env.id} value={env.id}>
                {env.name}
              </Select.Option>
            ))}
          </Select>
          <Button onClick={() => loadTasks()}>刷新</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        pagination={{
          current: filters.page,
          pageSize: filters.limit,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          onChange: (page, pageSize) => setFilters({ ...filters, page, limit: pageSize }),
        }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="创建种子任务"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateTask}>
          <Form.Item name="environmentId" label="选择环境" rules={[{ required: true }]}>
            <Select placeholder="请选择环境">
              {environments.map((env) => (
                <Select.Option key={env.id} value={env.id}>
                  {env.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="datasetId" label="选择数据集版本" rules={[{ required: true }]}>
            <Select placeholder="请选择数据集版本">
              {datasets.map((ds) => (
                <Select.Option key={ds.id} value={ds.id}>
                  {ds.name} - {ds.version}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="requestId" label="请求ID（幂等性）">
            <Input placeholder="相同请求ID会返回已有的任务，留空则自动生成" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="任务详情"
        width={800}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {selectedTask && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="环境">{selectedTask.Environment?.name}</Descriptions.Item>
              <Descriptions.Item label="数据集">{selectedTask.Dataset?.name}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedTask.Dataset?.version}</Descriptions.Item>
              <Descriptions.Item label="状态">{selectedTask.status}</Descriptions.Item>
              <Descriptions.Item label="总记录数">{selectedTask.totalRecords}</Descriptions.Item>
              <Descriptions.Item label="成功记录">{selectedTask.successRecords}</Descriptions.Item>
              <Descriptions.Item label="失败记录">{selectedTask.failedRecords}</Descriptions.Item>
              <Descriptions.Item label="重试次数">{selectedTask.retryCount}/{selectedTask.maxRetries}</Descriptions.Item>
              <Descriptions.Item label="幂等Key" span={2}>{selectedTask.idempotencyKey}</Descriptions.Item>
            </Descriptions>

            <h4>导入记录</h4>
            <Table
              columns={recordColumns}
              dataSource={records}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              style={{ marginBottom: 24 }}
            />

            <h4>回滚记录</h4>
            <Table
              columns={rollbackColumns}
              dataSource={rollbacks}
              rowKey="id"
              pagination={{ pageSize: 5 }}
            />
          </>
        )}
      </Drawer>
    </div>
  );
};

export default Tasks;
