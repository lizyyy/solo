import { useEffect, useState } from 'react';
import { 
  Card, Table, Button, Space, Input, Select, DatePicker, Tag, Modal, Form,
  Typography, message, Dropdown, Menu
} from 'antd';
import { PlusOutlined, SearchOutlined, DownloadOutlined, MoreOutlined, EyeOutlined, EditOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { appealApi, authApi, exportApi } from '../api';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLORS = {
  pending: 'default',
  processing: 'blue',
  reviewing: 'orange',
  completed: 'green',
  rejected: 'red'
};

const STATUS_NAMES = {
  pending: '待处理',
  processing: '处理中',
  reviewing: '待复核',
  completed: '已通过',
  rejected: '已驳回'
};

export default function AppealList() {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({});
  const [constants, setConstants] = useState({});
  const [users, setUsers] = useState([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [operators, setOperators] = useState([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { isAdmin, isOperator, isReviewer } = useAuth();

  useEffect(() => {
    loadConstants();
    loadUsers();
  }, []);

  useEffect(() => {
    loadAppeals();
  }, [pagination.current, pagination.pageSize, filters]);

  const loadConstants = async () => {
    try {
      const { data } = await appealApi.getConstants();
      setConstants(data);
    } catch (err) {
      console.error('加载常量失败', err);
    }
  };

  const loadUsers = async () => {
    try {
      const { data } = await authApi.getUsers();
      setUsers(data.users);
      setOperators(data.users.filter(u => u.role === 'operator'));
    } catch (err) {
      console.error('加载用户失败', err);
    }
  };

  const loadAppeals = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters
      };
      const { data } = await appealApi.getList(params);
      setAppeals(data.list);
      setPagination(prev => ({ ...prev, total: data.total }));
    } catch (err) {
      console.error('加载申诉列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleCreate = async (values) => {
    try {
      await appealApi.create(values);
      message.success('创建申诉成功');
      setCreateModalVisible(false);
      form.resetFields();
      loadAppeals();
    } catch (err) {
      message.error('创建申诉失败');
    }
  };

  const handlePickup = async (record) => {
    Modal.confirm({
      title: '确认领取',
      content: `确认要领取该申诉吗？`,
      onOk: async () => {
        try {
          await appealApi.pickup(record.id);
          message.success('领取成功');
          loadAppeals();
        } catch (err) {
            message.error('领取失败');
          }
        }
    });
  };

  const handleAssign = async (values) => {
    if (!selectedAppeal) return;
    try {
      await appealApi.assign(selectedAppeal.id, values.operator_id);
      message.success('分配成功');
      setAssignModalVisible(false);
      loadAppeals();
    } catch (err) {
      message.error('分配失败');
    }
  };

  const handleExport = () => {
    exportApi.exportAppeals(filters);
  };

  const columns = [
    {
      title: '申诉编号',
      dataIndex: 'appeal_no',
      key: 'appeal_no',
      width: 200,
      render: (text) => <span style={{ fontFamily: 'monospace' }}>{text}</span>
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '内容类型',
      dataIndex: 'content_type',
      key: 'content_type',
      width: 100,
      render: (type) => {
        const ct = constants.content_types?.find(c => c.value === type);
        return ct?.label || type;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: Object.entries(STATUS_NAMES).map(([value, label]) => ({ text: label, value })),
      onFilter: (value, record) => record.status === value,
      render: (status) => (
        <Tag color={STATUS_COLORS[status]}>
          {STATUS_NAMES[status]}
        </Tag>
      )
    },
    {
      title: '操作员',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 100,
      render: (name) => name || '-'
    },
    {
      title: '复核员',
      dataIndex: 'reviewer_name',
      key: 'reviewer_name',
      width: 100,
      render: (name) => name || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time) => new Date(time).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/appeals/${record.id}`)}
          >
            查看
          </Button>
          {isAdmin() && record.status === 'pending' && (
            <Button
              type="link"
              icon={<UserSwitchOutlined />}
              onClick={() => {
                setSelectedAppeal(record);
                setAssignModalVisible(true);
              }}
            >
              分配
            </Button>
          )}
          {isOperator() && record.status === 'pending' && !record.operator_id && (
            <Button
              type="link"
              onClick={() => handlePickup(record)}
            >
              领取
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Title level={3}>申诉管理</Title>
      
      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={[16, 16]} style={{ width: '100%' }}>
          <Input
            placeholder="搜索申诉编号、标题、内容"
            style={{ width: 250 }}
            allowClear
            prefix={<SearchOutlined />}
            onSearch={(value) => handleSearch({ ...filters, keyword: value })}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => handleSearch({ ...filters, status: value })}
          >
            {Object.entries(STATUS_NAMES).map(([value, label]) => (
              <Select.Option key={value} value={value}>
                {label}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="内容类型"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => handleSearch({ ...filters, content_type: value })}
          >
            {constants.content_types?.map((ct) => (
              <Select.Option key={ct.value} value={ct.value}>
                {ct.label}
              </Select.Option>
            ))}
          </Select>
          {isAdmin() && (
            <Select
              placeholder="操作员"
              allowClear
              style={{ width: 150 }}
              onChange={(value) => handleSearch({ ...filters, operator_id: value })}
            >
              {operators.map((user) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name}
                </Select.Option>
              ))}
            </Select>
          )}
          <RangePicker
              showTime
              onChange={(dates) => {
                if (dates) {
                  handleSearch({
                    ...filters,
                    start_time: dates[0]?.format('YYYY-MM-DD HH:mm:ss'),
                    end_time: dates[1]?.format('YYYY-MM-DD HH:mm:ss')
                  });
                } else {
                  const { start_time, end_time, ...rest } = filters;
                  handleSearch(rest);
                }
              }}
            />
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => setCreateModalVisible(true)}
          >
            新建申诉
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={appeals}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
            onShowSizeChange: (current, pageSize) => setPagination({ ...pagination, current: 1, pageSize })
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title="新建申诉"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
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
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item
            name="content"
            label="申诉内容"
            rules={[{ required: true, message: '请输入申诉内容' }]}
          >
            <Input.TextArea rows={4} placeholder="请详细描述申诉内容" />
          </Form.Item>
          <Form.Item
            name="content_type"
            label="内容类型"
            rules={[{ required: true, message: '请选择内容类型' }]}
          >
            <Select placeholder="请选择内容类型">
              {constants.content_types?.map((ct) => (
                <Select.Option key={ct.value} value={ct.value}>
                  {ct.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="source_platform" label="来源平台">
            <Input placeholder="如：抖音、微博等" />
          </Form.Item>
          <Form.Item name="source_id" label="来源ID">
            <Input placeholder="原始内容ID或链接" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="分配操作员"
        open={assignModalVisible}
        onCancel={() => setAssignModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAssign}
        >
          <Form.Item
            name="operator_id"
            label="选择操作员"
            rules={[{ required: true, message: '请选择操作员' }]}
          >
            <Select placeholder="请选择要分配的操作员">
              {operators.map((user) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
