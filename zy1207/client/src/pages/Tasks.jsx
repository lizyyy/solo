import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Popconfirm,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Tabs,
  Radio,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { tasksAPI, testBatchesAPI, interfacesAPI } from '../services/api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const priorityConfig = {
  high: { color: '#ff4d4f', label: '高' },
  medium: { color: '#faad14', label: '中' },
  low: { color: '#52c41a', label: '低' },
};

const statusConfig = {
  todo: { color: 'default', label: '待处理', icon: ClockCircleOutlined },
  in_progress: { color: 'processing', label: '进行中', icon: SyncOutlined },
  done: { color: 'success', label: '已完成', icon: CheckCircleOutlined },
};

const bottleneckTypes = [
  'CPU', '内存', '网络', '数据库', '缓存', 'GC', '锁竞争', '代码逻辑', '依赖服务', '配置问题', '其他'
];

function Tasks() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [allInterfaces, setAllInterfaces] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [filterStatus, setFilterStatus] = useState(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    loadBatches();
    loadInterfaces();
  }, [pagination.current, pagination.pageSize, filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await tasksAPI.getList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        status: filterStatus,
      });
      setData(res.data.data);
      setPagination(prev => ({ ...prev, total: res.data.total }));
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async () => {
    try {
      const res = await testBatchesAPI.getList({ pageSize: 100 });
      setAllBatches(res.data.data);
    } catch (error) {
      console.error('加载批次失败:', error);
    }
  };

  const loadInterfaces = async () => {
    try {
      const res = await interfacesAPI.getList({ pageSize: 100 });
      setAllInterfaces(res.data.data);
    } catch (error) {
      console.error('加载接口失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      due_date: record.due_date ? dayjs(record.due_date) : undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await tasksAPI.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleComplete = async (record) => {
    try {
      await tasksAPI.complete(record.id);
      message.success('已标记为完成');
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { due_date, ...rest } = values;
      
      const submitData = {
        ...rest,
        due_date: due_date?.toISOString(),
      };
      
      if (editingItem) {
        await tasksAPI.update(editingItem.id, submitData);
        message.success('更新成功');
      } else {
        await tasksAPI.create(submitData);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadData();
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error('保存失败');
    }
  };

  const stats = {
    total: data.length,
    todo: data.filter(t => t.status === 'todo').length,
    in_progress: data.filter(t => t.status === 'in_progress').length,
    done: data.filter(t => t.status === 'done').length,
    highPriority: data.filter(t => t.priority === 'high' && t.status !== 'done').length,
  };

  const columns = [
    {
      title: '任务标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{text}</span>
          {record.priority === 'high' && record.status !== 'done' && (
            <Tag color="red">紧急</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (val) => (
        <Tag color={priorityConfig[val]?.color}>
          {priorityConfig[val]?.label || val}
        </Tag>
      ),
      filters: [
        { text: '高', value: 'high' },
        { text: '中', value: 'medium' },
        { text: '低', value: 'low' },
      ],
      onFilter: (value, record) => record.priority === value,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val) => {
        const Icon = statusConfig[val]?.icon;
        return (
          <Tag color={statusConfig[val]?.color}>
            {Icon && <Icon style={{ marginRight: 4 }} />}
            {statusConfig[val]?.label || val}
          </Tag>
        );
      },
      filters: [
        { text: '待处理', value: 'todo' },
        { text: '进行中', value: 'in_progress' },
        { text: '已完成', value: 'done' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '瓶颈类型',
      dataIndex: 'bottleneck_type',
      key: 'bottleneck_type',
      width: 100,
      render: (val) => val || '-',
    },
    {
      title: '关联批次',
      dataIndex: 'batch_name',
      key: 'batch_name',
      width: 150,
      render: (val) => val || '-',
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 100,
      render: (val) => val || '-',
    },
    {
      title: '截止日期',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 120,
      render: (val) => {
        if (!val) return '-';
        const isOverdue = dayjs(val).isBefore(dayjs(), 'day');
        return (
          <span style={{ color: isOverdue ? '#ff4d4f' : undefined }}>
            {dayjs(val).format('YYYY-MM-DD')}
          </span>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small" wrap>
          {record.status !== 'done' && (
            <Button 
              type="link" 
              size="small" 
              icon={<CheckCircleOutlined />}
              onClick={() => handleComplete(record)}
            >
              完成
            </Button>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个任务吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="全部任务"
              value={stats.total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="待处理"
              value={stats.todo}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="进行中"
              value={stats.in_progress}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={stats.done}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="高优先级待处理"
              value={stats.highPriority}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="完成率"
              value={stats.total > 0 ? ((stats.done / stats.total) * 100).toFixed(1) : 0}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Radio.Group value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <Radio.Button value={undefined}>全部</Radio.Button>
            <Radio.Button value="todo">待处理</Radio.Button>
            <Radio.Button value="in_progress">进行中</Radio.Button>
            <Radio.Button value="done">已完成</Radio.Button>
          </Radio.Group>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建任务
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
        }}
        expandable={{
          expandedRowRender: (record) => (
            <Card size="small" style={{ background: '#fafafa' }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {record.description || '暂无描述'}
              </div>
              {record.completed_at && (
                <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                  完成时间: {record.completed_at}
                </div>
              )}
            </Card>
          ),
        }}
      />

      <Modal
        title={editingItem ? '编辑任务' : '新建任务'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="任务标题"
            rules={[{ required: true, message: '请输入任务标题' }]}
          >
            <Input placeholder="简要描述任务内容" />
          </Form.Item>

          <Form.Item name="description" label="详细描述">
            <TextArea rows={4} placeholder="详细描述任务内容和执行步骤" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="priority" label="优先级" initialValue="medium">
                <Select>
                  <Option value="high" style={{ color: '#ff4d4f' }}>高</Option>
                  <Option value="medium" style={{ color: '#faad14' }}>中</Option>
                  <Option value="low" style={{ color: '#52c41a' }}>低</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" initialValue="todo">
                <Select>
                  <Option value="todo">待处理</Option>
                  <Option value="in_progress">进行中</Option>
                  <Option value="done">已完成</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bottleneck_type" label="瓶颈类型">
                <Select placeholder="选择瓶颈类型" allowClear>
                  {bottleneckTypes.map(type => (
                    <Option key={type} value={type}>{type}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="batch_id" label="关联压测批次">
                <Select placeholder="选择关联的压测批次" allowClear>
                  {allBatches.map(b => (
                    <Option key={b.id} value={b.id}>
                      {b.name} (#{b.batch_number}){b.is_baseline ? ' [基线]' : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="related_interface_id" label="关联接口">
                <Select placeholder="选择关联的接口" allowClear>
                  {allInterfaces.map(i => (
                    <Option key={i.id} value={i.id}>
                      {i.method} {i.path} - {i.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="assignee" label="负责人">
                <Input placeholder="指定负责人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="due_date" label="截止日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

export default Tasks;
