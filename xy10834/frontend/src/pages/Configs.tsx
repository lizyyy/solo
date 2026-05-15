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
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  CloudSyncOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { configApi, distributionApi, pullApi, diffApi } from '../services/api';
import { ConfigItem, ConfigStatus } from '../types';

const { Option } = Select;

function ConfigsPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ status: '', key: '' });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);
  const [form] = Form.useForm();

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const response = await configApi.getList({
        page: pagination.current,
        pageSize: pagination.pageSize,
        status: filters.status || undefined,
        key: filters.key || undefined,
      });
      setConfigs(response.data.data.items);
      setPagination({
        ...pagination,
        total: response.data.data.pagination.total,
      });
    } catch (error) {
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, [pagination.current, pagination.pageSize, filters]);

  const handleCreate = () => {
    setEditingConfig(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: ConfigItem) => {
    setEditingConfig(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await configApi.delete(id);
      message.success('删除成功');
      loadConfigs();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingConfig) {
        await configApi.update(editingConfig.id, values);
        message.success('更新成功');
      } else {
        await configApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadConfigs();
    } catch (error) {
      message.error(editingConfig ? '更新失败' : '创建失败');
    }
  };

  const handlePublish = async (record: ConfigItem) => {
    Modal.confirm({
      title: '发布确认',
      content: `确定要发布配置 "${record.key}" 吗？`,
      onOk: async () => {
        try {
          await distributionApi.publish({
            configId: record.id,
            releasedBy: 'admin',
            releaseNote: '手动发布',
          });
          message.success('发布成功');
          loadConfigs();
        } catch (error) {
          message.error('发布失败');
        }
      },
    });
  };

  const handleForceRefresh = async (record: ConfigItem) => {
    Modal.confirm({
      title: '强制刷新确认',
      content: `确定要强制刷新配置 "${record.key}" 吗？`,
      onOk: async () => {
        try {
          await distributionApi.forceRefresh(record.id);
          message.success('刷新指令已下发');
        } catch (error) {
          message.error('刷新失败');
        }
      },
    });
  };

  const handleDetectOldValues = async (record: ConfigItem) => {
    try {
      const response = await pullApi.detectOldValues(record.id);
      const data = response.data.data;
      Modal.info({
        title: '旧值检测结果',
        content: (
          <div>
            <p>配置当前版本: {data.configVersion}</p>
            <p>存在旧值的实例数: {data.oldValueCount}</p>
            {data.oldValueCount > 0 && (
              <div>
                <h4>旧值实例列表:</h4>
                <ul>
                  {data.instances.slice(0, 10).map((i: any) => (
                    <li key={i.id}>{i.serviceInstance?.instanceId} - v{i.currentVersion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ),
      });
    } catch (error) {
      message.error('检测失败');
    }
  };

  const handleExport = (record: ConfigItem) => {
    diffApi.exportEffectiveStates(record.id);
  };

  const columns = [
    { title: '配置键', dataIndex: 'key', key: 'key', width: 200 },
    { title: '配置值', dataIndex: 'value', key: 'value', ellipsis: true },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ConfigStatus) => (
        <Tag color={status === ConfigStatus.PUBLISHED ? 'success' : status === ConfigStatus.DRAFT ? 'default' : 'warning'}>
          {status}
        </Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作',
      key: 'action',
      width: 320,
      render: (_: any, record: ConfigItem) => (
        <Space size="small">
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.status === ConfigStatus.DRAFT && (
            <Button type="primary" size="small" onClick={() => handlePublish(record)}>
              发布
            </Button>
          )}
          <Button icon={<CloudSyncOutlined />} size="small" onClick={() => handleForceRefresh(record)}>
            强制刷新
          </Button>
          <Button icon={<FileSearchOutlined />} size="small" onClick={() => handleDetectOldValues(record)}>
            旧值检测
          </Button>
          <Button size="small" onClick={() => handleExport(record)}>
            导出
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
        title="配置项"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建配置
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索配置键"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            onPressEnter={(e) => setFilters({ ...filters, key: (e.target as HTMLInputElement).value })}
          />
          <Select
            placeholder="选择状态"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => setFilters({ ...filters, status: value || '' })}
          >
            <Option value={ConfigStatus.DRAFT}>草稿</Option>
            <Option value={ConfigStatus.PUBLISHED}>已发布</Option>
          </Select>
          <Button onClick={() => setFilters({ status: '', key: '' })}>重置</Button>
        </Space>

        <Table
          loading={loading}
          dataSource={configs}
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
        title={editingConfig ? '编辑配置' : '新建配置'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="key" label="配置键" rules={[{ required: true, message: '请输入配置键' }]}>
            <Input disabled={!!editingConfig} />
          </Form.Item>
          <Form.Item name="value" label="配置值" rules={[{ required: true, message: '请输入配置值' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
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

export default ConfigsPage;
