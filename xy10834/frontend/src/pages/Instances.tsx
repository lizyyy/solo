import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Modal,
  Form,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { instanceApi } from '../services/api';
import { ServiceInstance, InstanceStatus } from '../types';

const { Option } = Select;

function InstancesPage() {
  const [instances, setInstances] = useState<ServiceInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ status: '', serviceName: '' });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingInstance, setEditingInstance] = useState<ServiceInstance | null>(null);
  const [form] = Form.useForm();

  const loadInstances = async () => {
    setLoading(true);
    try {
      const response = await instanceApi.getList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        serviceName: filters.serviceName || undefined,
        status: filters.status || undefined,
      });
      setInstances(response.data.data.instances);
      setPagination({
        ...pagination,
        total: response.data.data.pagination.total,
      });
    } catch (error) {
      message.error('加载实例失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, [pagination.current, pagination.pageSize, filters]);

  const handleCreate = () => {
    setEditingInstance(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: ServiceInstance) => {
    setEditingInstance(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await instanceApi.delete(id);
      message.success('删除成功');
      loadInstances();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingInstance) {
        await instanceApi.updateStatus(editingInstance.id, values.status);
        message.success('更新成功');
      } else {
        await instanceApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadInstances();
    } catch (error) {
      message.error(editingInstance ? '更新失败' : '创建失败');
    }
  };

  const columns = [
    { title: '实例ID', dataIndex: 'instanceId', key: 'instanceId', width: 150 },
    { title: '服务名', dataIndex: 'serviceName', key: 'serviceName', width: 150 },
    { title: 'IP地址', dataIndex: 'ipAddress', key: 'ipAddress', width: 130 },
    { title: '环境', dataIndex: 'env', key: 'env', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: InstanceStatus) => (
        <Tag color={status === InstanceStatus.ONLINE ? 'success' : 'error'}>
          {status}
        </Tag>
      ),
    },
    { title: '最后心跳', dataIndex: 'lastHeartbeat', key: 'lastHeartbeat', width: 180, render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: ServiceInstance) => (
        <Space size="small">
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button icon={<DeleteOutlined />} size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="服务实例"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建实例
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索服务名"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            onPressEnter={(e) => setFilters({ ...filters, serviceName: (e.target as HTMLInputElement).value })}
          />
          <Select
            placeholder="选择状态"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => setFilters({ ...filters, status: value || '' })}
          >
            <Option value={InstanceStatus.ONLINE}>在线</Option>
            <Option value={InstanceStatus.OFFLINE}>离线</Option>
          </Select>
          <Button onClick={() => setFilters({ status: '', serviceName: '' })}>重置</Button>
        </Space>

        <Table
          loading={loading}
          dataSource={instances}
          columns={columns}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize }),
          }}
        />
      </Card>

      <Modal
        title={editingInstance ? '编辑实例' : '新建实例'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="instanceId" label="实例ID" rules={[{ required: true }]}>
            <Input disabled={!!editingInstance} />
          </Form.Item>
          <Form.Item name="serviceName" label="服务名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="ipAddress" label="IP地址" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="hostname" label="主机名">
            <Input />
          </Form.Item>
          <Form.Item name="env" label="环境" rules={[{ required: true }]}>
            <Select>
              <Option value="production">生产环境</Option>
              <Option value="staging">预发布环境</Option>
              <Option value="development">开发环境</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select>
              <Option value={InstanceStatus.ONLINE}>在线</Option>
              <Option value={InstanceStatus.OFFLINE}>离线</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default InstancesPage;
