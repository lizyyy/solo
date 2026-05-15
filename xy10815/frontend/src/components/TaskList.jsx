import React, { useState, useEffect } from 'react';
import {
  Table,
  Space,
  Button,
  Input,
  Select,
  Modal,
  Form,
  Progress,
  Tag,
  message,
  Upload
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DownloadOutlined,
  UploadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { taskApi } from '../api/task';
import dayjs from 'dayjs';

const { Option } = Select;

const statusColors = {
  PENDING: 'default',
  RUNNING: 'processing',
  PAUSED: 'warning',
  COMPLETED: 'success',
  FAILED: 'error',
  CANCELLED: 'default'
};

const statusLabels = {
  PENDING: '待处理',
  RUNNING: '运行中',
  PAUSED: '已暂停',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消'
};

const taskTypeLabels = {
  EXPORT: '导出',
  TRANSCODE: '转码',
  PUSH: '推送'
};

function TaskList({ onViewDetail }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchTasks = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const res = await taskApi.list({ ...filters, page, pageSize });
      setData(res.data.list);
      setPagination({
        current: res.data.page,
        pageSize: res.data.pageSize,
        total: res.data.total
      });
    } catch (err) {
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filters]);

  const handleSearch = (values) => {
    setFilters(values);
  };

  const handleCreate = async (values) => {
    try {
      await taskApi.create(values);
      message.success('创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      fetchTasks();
    } catch (err) {
      message.error(err.response?.data?.error || '创建失败');
    }
  };

  const handleExport = async () => {
    try {
      const res = await taskApi.export(filters);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `tasks_${dayjs().format('YYYYMMDDHHmmss')}.csv`;
      link.click();
      message.success('导出成功');
    } catch (err) {
      message.error('导出失败');
    }
  };

  const handleImport = async (info) => {
    const { file } = info;
    try {
      const res = await taskApi.import(file);
      const successCount = res.data.results.filter(r => r.success).length;
      const failCount = res.data.total - successCount;
      message.success(`导入完成：成功 ${successCount} 条，失败 ${failCount} 条`);
      fetchTasks();
    } catch (err) {
      message.error('导入失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80
    },
    {
      title: '任务类型',
      dataIndex: 'task_type',
      width: 100,
      render: (type) => taskTypeLabels[type] || type
    },
    {
      title: '业务单号',
      dataIndex: 'business_no',
      width: 150
    },
    {
      title: '状态',
      dataIndex: 'current_status',
      width: 100,
      render: (status) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      )
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 150,
      render: (progress) => (
        <Progress percent={progress} size="small" />
      )
    },
    {
      title: '统计',
      width: 200,
      render: (_, record) => (
        <span>
          总计: {record.total_count} | 
          成功: <span style={{ color: '#52c41a' }}>{record.success_count}</span> | 
          失败: <span style={{ color: '#ff4d4f' }}>{record.fail_count}</span>
        </span>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewDetail(record.id)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Form layout="inline" onFinish={handleSearch}>
            <Form.Item name="task_type">
              <Select placeholder="任务类型" style={{ width: 120 }} allowClear>
                <Option value="EXPORT">导出</Option>
                <Option value="TRANSCODE">转码</Option>
                <Option value="PUSH">推送</Option>
              </Select>
            </Form.Item>
            <Form.Item name="current_status">
              <Select placeholder="状态" style={{ width: 120 }} allowClear>
                <Option value="PENDING">待处理</Option>
                <Option value="RUNNING">运行中</Option>
                <Option value="PAUSED">已暂停</Option>
                <Option value="COMPLETED">已完成</Option>
                <Option value="FAILED">失败</Option>
                <Option value="CANCELLED">已取消</Option>
              </Select>
            </Form.Item>
            <Form.Item name="business_no">
              <Input placeholder="业务单号" style={{ width: 150 }} allowClear />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">搜索</Button>
            </Form.Item>
          </Form>
        </Space>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新建任务
          </Button>
          <Upload
            showUploadList={false}
            customRequest={handleImport}
            accept=".csv"
          >
            <Button icon={<UploadOutlined />}>批量导入</Button>
          </Upload>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出报告
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => fetchTasks()}>
            刷新
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => fetchTasks(page, pageSize)
        }}
      />

      <Modal
        title="新建任务"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="task_type"
            label="任务类型"
            rules={[{ required: true, message: '请选择任务类型' }]}
          >
            <Select>
              <Option value="EXPORT">导出</Option>
              <Option value="TRANSCODE">转码</Option>
              <Option value="PUSH">推送</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="business_no"
            label="业务单号"
            rules={[{ required: true, message: '请输入业务单号' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="total_count" label="总数">
            <Input type="number" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default TaskList;
