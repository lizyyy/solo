import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Statistic,
  Row,
  Col,
  Modal,
  Form,
  message,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  StopOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { taskApi } from '../api';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;

const StatusIcon = ({ status }) => {
  const icons = {
    success: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
    failed: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
    paused: <PauseCircleOutlined style={{ color: '#faad14' }} />,
    running: <SyncOutlined style={{ color: '#1890ff', animation: 'spin 1s linear infinite' }} />,
    pending: <ClockCircleOutlined style={{ color: '#8c8c8c' }} />,
    blocked: <StopOutlined style={{ color: '#fa8c16' }} />,
  };
  return icons[status] || null;
};

const StatusTag = ({ status }) => {
  const colors = {
    success: 'green',
    failed: 'red',
    paused: 'orange',
    running: 'blue',
    pending: 'default',
    blocked: 'warning',
  };
  const labels = {
    success: '成功',
    failed: '失败',
    paused: '已暂停',
    running: '执行中',
    pending: '待执行',
    blocked: '已拦截',
  };
  return (
    <Tag icon={<StatusIcon status={status} />} color={colors[status]}>
      {labels[status] || status}
    </Tag>
  );
};

const StageTag = ({ stage }) => {
  const colors = {
    init: 'default',
    data_prepare: 'cyan',
    index_building: 'blue',
    verification: 'purple',
    gray_release: 'orange',
    full_switch: 'geekblue',
    completed: 'green',
    failed: 'red',
    rolled_back: 'volcano',
  };
  const labels = {
    init: '初始化',
    data_prepare: '数据准备',
    index_building: '索引构建',
    verification: '验证查询',
    gray_release: '灰度发布',
    full_switch: '全量切换',
    completed: '已完成',
    failed: '失败',
    rolled_back: '已回滚',
  };
  return <Tag color={colors[stage]}>{labels[stage] || stage}</Tag>;
};

function TaskList() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await taskApi.getTasks(filters);
      setTasks(res.data);
    } catch (err) {
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await taskApi.getStats();
      setStats(res.data);
    } catch (err) {
      console.error('获取统计数据失败');
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [filters]);

  const handleCreateTask = async (values) => {
    try {
      await taskApi.createTask(values);
      message.success('创建任务成功');
      setModalVisible(false);
      form.resetFields();
      fetchTasks();
      fetchStats();
    } catch (err) {
      message.error('创建任务失败');
    }
  };

  const handleExport = () => {
    taskApi.exportCsv();
    message.success('开始导出CSV文件');
  };

  const columns = [
    {
      title: '索引名称',
      dataIndex: 'index_name',
      key: 'index_name',
      width: 180,
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 120,
      render: (stage) => <StageTag stage={stage} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: '版本',
      key: 'version',
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>当前: {record.current_version || '-'}</div>
          <div style={{ fontSize: '12px' }}>目标: {record.target_version}</div>
        </div>
      ),
    },
    {
      title: '状态原因',
      dataIndex: 'state_reason',
      key: 'state_reason',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '灰度流量',
      dataIndex: 'gray_traffic_percentage',
      key: 'gray_traffic_percentage',
      width: 100,
      render: (val) => (val !== null && val !== undefined ? `${val}%` : '-'),
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (ts) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/tasks/${record.id}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="任务总数"
              value={stats?.total || 0}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="执行中"
              value={stats?.byStatus?.running?.count || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SyncOutlined spin />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats?.byStatus?.success?.count || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败/拦截"
              value={(stats?.byStatus?.failed?.count || 0) + (stats?.byStatus?.blocked?.count || 0)}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchTasks();
                fetchStats();
              }}
            >
              刷新
            </Button>
            <Select
              placeholder="筛选阶段"
              style={{ width: 150 }}
              allowClear
              onChange={(val) => setFilters({ ...filters, stage: val })}
            >
              <Option value="init">初始化</Option>
              <Option value="data_prepare">数据准备</Option>
              <Option value="index_building">索引构建</Option>
              <Option value="verification">验证查询</Option>
              <Option value="gray_release">灰度发布</Option>
              <Option value="full_switch">全量切换</Option>
              <Option value="completed">已完成</Option>
              <Option value="failed">失败</Option>
              <Option value="rolled_back">已回滚</Option>
            </Select>
            <Select
              placeholder="筛选状态"
              style={{ width: 150 }}
              allowClear
              onChange={(val) => setFilters({ ...filters, status: val })}
            >
              <Option value="pending">待执行</Option>
              <Option value="running">执行中</Option>
              <Option value="paused">已暂停</Option>
              <Option value="success">成功</Option>
              <Option value="failed">失败</Option>
              <Option value="blocked">已拦截</Option>
            </Select>
            <Search
              placeholder="搜索索引名称"
              style={{ width: 250 }}
              onSearch={(val) => setFilters({ ...filters, indexName: val })}
              allowClear
            />
          </Space>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出CSV
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalVisible(true)}
            >
              新建任务
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="新建索引重建任务"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateTask}>
          <Form.Item
            name="indexName"
            label="索引名称"
            rules={[{ required: true, message: '请输入索引名称' }]}
          >
            <Input placeholder="例如: product_search_v2" />
          </Form.Item>
          <Form.Item
            name="dataSource"
            label="数据源"
            rules={[{ required: true, message: '请输入数据源' }]}
          >
            <Input placeholder="例如: mysql://product_db" />
          </Form.Item>
          <Form.Item
            name="targetVersion"
            label="目标版本"
            rules={[{ required: true, message: '请输入目标版本' }]}
          >
            <Input placeholder="例如: v2.3.1" />
          </Form.Item>
          <Form.Item name="currentVersion" label="当前版本">
            <Input placeholder="例如: v2.3.0" />
          </Form.Item>
          <Form.Item name="verifyQuery" label="验证查询">
            <Input.TextArea rows={3} placeholder="输入用于验证的查询语句" />
          </Form.Item>
          <Form.Item name="createdBy" label="创建人">
            <Input placeholder="您的名字或工号" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
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

export default TaskList;