import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Typography,
  Card
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { activityApi } from '../services/api';
import { ACTIVITY_STATUS, getActivityStatusLabel } from '../utils/constants';
import { useAuthStore } from '../store/authStore';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Option } = Select;

const Activities = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [viewingActivity, setViewingActivity] = useState(null);
  const [form] = Form.useForm();
  const { user } = useAuthStore();

  const canEdit = user?.role === 'admin' || user?.role === 'manager';
  const canDelete = user?.role === 'admin';

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const res = await activityApi.list({ page, limit: pageSize });
      setActivities(res.data.data);
      setPagination({
        current: res.data.pagination.page,
        pageSize: res.data.pagination.limit,
        total: res.data.pagination.total
      });
    } catch (error) {
      console.error('加载活动失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (pagination) => {
    loadActivities(pagination.current, pagination.pageSize);
  };

  const handleCreate = () => {
    setEditingActivity(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (activity) => {
    setEditingActivity(activity);
    form.setFieldsValue({
      ...activity,
      timeRange: [dayjs(activity.startTime), dayjs(activity.endTime)]
    });
    setModalVisible(true);
  };

  const handleView = async (id) => {
    try {
      const res = await activityApi.get(id);
      setViewingActivity(res.data.data);
      setDetailVisible(true);
    } catch (error) {
      console.error('加载活动详情失败:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await activityApi.delete(id);
      message.success('删除成功');
      loadActivities(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        startTime: values.timeRange[0].toISOString(),
        endTime: values.timeRange[1].toISOString()
      };
      delete data.timeRange;

      if (editingActivity) {
        await activityApi.update(editingActivity.id, data);
        message.success('更新成功');
      } else {
        await activityApi.create(data);
        message.success('创建成功');
      }

      setModalVisible(false);
      loadActivities(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await activityApi.updateStatus(id, status);
      message.success('状态更新成功');
      loadActivities(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('状态更新失败:', error);
    }
  };

  const columns = [
    {
      title: '活动名称',
      dataIndex: 'name',
      key: 'name',
      width: 200
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location',
      width: 150
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '最大参与人数',
      dataIndex: 'maxParticipants',
      key: 'maxParticipants',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status, record) => (
        canEdit ? (
          <Select
            value={status}
            style={{ width: 120 }}
            onChange={(value) => handleStatusChange(record.id, value)}
          >
            {Object.values(ACTIVITY_STATUS).map((s) => (
              <Option key={s.value} value={s.value}>
                {s.label}
              </Option>
            ))}
          </Select>
        ) : (
          <Tag color={ACTIVITY_STATUS[status]?.color || 'default'}>
            {getActivityStatusLabel(status)}
          </Tag>
        )
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record.id)}
          >
            查看
          </Button>
          {canEdit && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          {canDelete && (
            <Popconfirm
              title="确定要删除这个活动吗？"
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

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>活动管理</Title>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建活动
          </Button>
        )}
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={activities}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title={editingActivity ? '编辑活动' : '新建活动'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="活动名称"
            rules={[{ required: true, message: '请输入活动名称' }]}
          >
            <Input placeholder="请输入活动名称" />
          </Form.Item>

          <Form.Item name="description" label="活动描述">
            <TextArea rows={3} placeholder="请输入活动描述" />
          </Form.Item>

          <Form.Item
            name="location"
            label="活动地点"
            rules={[{ required: true, message: '请输入活动地点' }]}
          >
            <Input placeholder="请输入活动地点" />
          </Form.Item>

          <Form.Item
            name="timeRange"
            label="活动时间"
            rules={[{ required: true, message: '请选择活动时间' }]}
          >
            <RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="maxParticipants"
            label="最大参与人数"
            rules={[{ required: true, message: '请输入最大参与人数' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入最大参与人数" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="活动详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {viewingActivity && (
          <div>
            <p><strong>名称：</strong>{viewingActivity.name}</p>
            <p><strong>地点：</strong>{viewingActivity.location}</p>
            <p><strong>开始时间：</strong>{dayjs(viewingActivity.startTime).format('YYYY-MM-DD HH:mm')}</p>
            <p><strong>结束时间：</strong>{dayjs(viewingActivity.endTime).format('YYYY-MM-DD HH:mm')}</p>
            <p><strong>最大参与人数：</strong>{viewingActivity.maxParticipants}</p>
            <p><strong>状态：</strong>
              <Tag color={ACTIVITY_STATUS[viewingActivity.status]?.color || 'default'}>
                {getActivityStatusLabel(viewingActivity.status)}
              </Tag>
            </p>
            {viewingActivity.description && (
              <p><strong>描述：</strong>{viewingActivity.description}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Activities;
