import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Typography,
  Card,
  Timeline,
  Descriptions,
  InputNumber,
  Checkbox,
  Row,
  Col
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { registrationApi, activityApi } from '../services/api';
import {
  REGISTRATION_STATUS,
  getRegistrationStatusLabel,
  getAvailableTransitions,
  getActivityStatusLabel
} from '../utils/constants';
import { useAuthStore } from '../store/authStore';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const Registrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState(null);
  const [viewingRegistration, setViewingRegistration] = useState(null);
  const [currentStatusTarget, setCurrentStatusTarget] = useState(null);
  const [filterForm] = Form.useForm();
  const [form] = Form.useForm();
  const [statusForm] = Form.useForm();
  const { user } = useAuthStore();

  const canEdit = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';
  const canDelete = user?.role === 'admin';

  useEffect(() => {
    loadActivities();
    loadRegistrations();
  }, []);

  const loadActivities = async () => {
    try {
      const res = await activityApi.list({ limit: 100 });
      setActivities(res.data.data);
    } catch (error) {
      console.error('加载活动失败:', error);
    }
  };

  const loadRegistrations = async (page = 1, pageSize = 10, filters = {}) => {
    try {
      setLoading(true);
      const params = { page, limit: pageSize, ...filters };
      const res = await registrationApi.list(params);
      setRegistrations(res.data.data);
      setPagination({
        current: res.data.pagination.page,
        pageSize: res.data.pagination.limit,
        total: res.data.pagination.total
      });
    } catch (error) {
      console.error('加载报名记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (pagination) => {
    loadRegistrations(pagination.current, pagination.pageSize);
  };

  const handleSearch = () => {
    const values = filterForm.getFieldsValue();
    loadRegistrations(1, pagination.pageSize, values);
  };

  const handleReset = () => {
    filterForm.resetFields();
    loadRegistrations();
  };

  const handleCreate = () => {
    setEditingRegistration(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (registration) => {
    setEditingRegistration(registration);
    form.setFieldsValue(registration);
    setModalVisible(true);
  };

  const handleView = async (id) => {
    try {
      const res = await registrationApi.get(id);
      setViewingRegistration(res.data.data);
      setDetailVisible(true);
    } catch (error) {
      console.error('加载详情失败:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await registrationApi.delete(id);
      message.success('删除成功');
      loadRegistrations(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleStatusChange = (record) => {
    setCurrentStatusTarget({ type: 'single', ids: [record.id], currentStatus: record.status });
    statusForm.resetFields();
    setStatusModalVisible(true);
  };

  const handleBatchStatusChange = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择记录');
      return;
    }
    const currentStatus = registrations.find((r) => r.id === selectedRowKeys[0])?.status;
    setCurrentStatusTarget({ type: 'batch', ids: selectedRowKeys, currentStatus });
    statusForm.resetFields();
    setStatusModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingRegistration) {
        await registrationApi.update(editingRegistration.id, values);
        message.success('更新成功');
      } else {
        await registrationApi.create(values);
        message.success('创建成功');
      }

      setModalVisible(false);
      loadRegistrations(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const handleStatusSubmit = async () => {
    try {
      const values = await statusForm.validateFields();
      const { ids, type } = currentStatusTarget;

      if (type === 'single') {
        await registrationApi.updateStatus(ids[0], values.newStatus, values.reason);
        message.success('状态更新成功');
      } else {
        const result = await registrationApi.batchUpdateStatus(ids, values.newStatus, values.reason);
        message.success(
          `批量更新完成：成功 ${result.data.data.success}，失败 ${result.data.data.failed}`
        );
      }

      setStatusModalVisible(false);
      setSelectedRowKeys([]);
      loadRegistrations(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('状态更新失败:', error);
    }
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys)
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 130
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
      width: 150
    },
    {
      title: '活动',
      dataIndex: ['activity', 'name'],
      key: 'activity',
      width: 180
    },
    {
      title: '报名时间',
      dataIndex: 'registrationTime',
      key: 'registrationTime',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag className={REGISTRATION_STATUS[status]?.tagClass}>
          {getRegistrationStatusLabel(status)}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record.id)}
          >
            详情
          </Button>
          {canEdit && (
            <>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
              <Button
                type="link"
                onClick={() => handleStatusChange(record)}
              >
                状态
              </Button>
            </>
          )}
          {canDelete && (
            <Popconfirm
              title="确定要删除这条记录吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const availableTransitions = currentStatusTarget
    ? getAvailableTransitions(currentStatusTarget.currentStatus)
    : [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>报名管理</Title>
        {canEdit && (
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新增报名
            </Button>
          </Space>
        )}
      </div>

      <Card className="search-panel">
        <Form form={filterForm} layout="inline">
          <Form.Item name="search">
            <Input
              placeholder="搜索姓名/邮箱/公司"
              prefix={<SearchOutlined />}
              style={{ width: 250 }}
            />
          </Form.Item>
          <Form.Item name="activityId">
            <Select placeholder="选择活动" style={{ width: 200 }} allowClear>
              {activities.map((a) => (
                <Option key={a.id} value={a.id}>
                  {a.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status">
            <Select placeholder="选择状态" style={{ width: 150 }} allowClear>
              {Object.values(REGISTRATION_STATUS).map((s) => (
                <Option key={s.value} value={s.value}>
                  {s.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {canEdit && selectedRowKeys.length > 0 && (
        <Card className="batch-actions" size="small">
          <Space>
            <span>已选择 {selectedRowKeys.length} 条记录</span>
            <Button type="primary" onClick={handleBatchStatusChange}>
              批量更新状态
            </Button>
          </Space>
        </Card>
      )}

      <Card>
        <Table
          rowSelection={canEdit ? rowSelection : null}
          columns={columns}
          dataSource={registrations}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 1300 }}
        />
      </Card>

      <Modal
        title={editingRegistration ? '编辑报名' : '新增报名'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="activityId"
            label="活动"
            rules={[{ required: true, message: '请选择活动' }]}
          >
            <Select placeholder="请选择活动">
              {activities.map((a) => (
                <Option key={a.id} value={a.id}>
                  {a.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入有效的邮箱' }
                ]}
              >
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="电话">
                <Input placeholder="请输入电话" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="company" label="公司">
                <Input placeholder="请输入公司" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="报名详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {viewingRegistration && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="姓名">{viewingRegistration.name}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{viewingRegistration.email}</Descriptions.Item>
              <Descriptions.Item label="电话">{viewingRegistration.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="公司">{viewingRegistration.company || '-'}</Descriptions.Item>
              <Descriptions.Item label="活动">
                {viewingRegistration.activity?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag className={REGISTRATION_STATUS[viewingRegistration.status]?.tagClass}>
                  {getRegistrationStatusLabel(viewingRegistration.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="报名时间">
                {dayjs(viewingRegistration.registrationTime).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                {viewingRegistration.creator?.name || '-'}
              </Descriptions.Item>
            </Descriptions>

            {viewingRegistration.notes && (
              <div style={{ marginTop: 16 }}>
                <Title level={5}>备注</Title>
                <p>{viewingRegistration.notes}</p>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <Title level={5}>状态变更历史</Title>
              <Timeline className="status-timeline">
                {viewingRegistration.statusHistory?.map((item, index) => (
                  <Timeline.Item key={item.id}>
                    <div>
                      <strong>
                        {getRegistrationStatusLabel(item.newStatus)}
                      </strong>
                      {item.reason && <span> ({item.reason})</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')} -{' '}
                      {item.changedByUser?.name || '系统'}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="更新状态"
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        onOk={handleStatusSubmit}
        width={500}
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item
            name="newStatus"
            label="新状态"
            rules={[{ required: true, message: '请选择新状态' }]}
          >
            <Select placeholder="请选择新状态">
              {availableTransitions.map((status) => (
                <Option key={status} value={status}>
                  {getRegistrationStatusLabel(status)}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="变更原因">
            <TextArea rows={3} placeholder="请输入变更原因（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Registrations;
