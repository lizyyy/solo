import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Space,
  InputNumber,
  Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { cleanupApi, environmentApi } from '../services/api';
import { CleanupStrategy, Environment } from '../types';

const Cleanup: React.FC = () => {
  const [strategies, setStrategies] = useState<CleanupStrategy[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<CleanupStrategy | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [strategiesData, envsData] = await Promise.all([
        cleanupApi.getAll(),
        environmentApi.getAll(),
      ]);
      setStrategies(strategiesData);
      setEnvironments(envsData);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingStrategy) {
        await cleanupApi.updateCorrection(editingStrategy.id, values.correctionPath || '');
        message.success('更新成功');
      } else {
        await cleanupApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error) {
      message.error(editingStrategy ? '更新失败' : '创建失败');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await cleanupApi.execute(id);
      message.success('执行成功');
      loadData();
    } catch (error) {
      message.error('执行失败');
    }
  };

  const handleMarkFailed = async (id: string) => {
    try {
      await cleanupApi.markFailed(id, '手动标记失败');
      message.success('已标记为失败');
      loadData();
    } catch (error) {
      message.error('标记失败');
    }
  };

  const handleEdit = (record: CleanupStrategy) => {
    setEditingStrategy(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await cleanupApi.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '环境',
      dataIndex: ['Environment', 'name'],
      key: 'environment',
      width: 120,
    },
    {
      title: '清理类型',
      dataIndex: 'cleanupType',
      key: 'cleanupType',
      width: 120,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          soft_delete: '软删除',
          hard_delete: '硬删除',
          archive: '归档',
        };
        return typeMap[type] || type;
      },
    },
    {
      title: '保留天数',
      dataIndex: 'retentionDays',
      key: 'retentionDays',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'green',
          inactive: 'default',
          failed: 'red',
        };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    {
      title: '修正路径',
      dataIndex: 'correctionPath',
      key: 'correctionPath',
      ellipsis: true,
      render: (path: string) => path || '-',
    },
    {
      title: '最后执行',
      dataIndex: 'lastExecutedAt',
      key: 'lastExecutedAt',
      width: 180,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'),
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
      render: (_: any, record: CleanupStrategy) => (
        <Space size="small">
          <Button icon={<PlayCircleOutlined />} size="small" onClick={() => handleExecute(record.id)}>
            执行
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.status !== 'failed' && (
            <Popconfirm title="确认标记为失败?" onConfirm={() => handleMarkFailed(record.id)}>
              <Button icon={<WarningOutlined />} size="small" danger>
                标记失败
              </Button>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除该策略?" onConfirm={() => handleDelete(record.id)}>
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>清理策略</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingStrategy(null);
            form.resetFields();
            setModalVisible(true);
          }}
        >
          新建策略
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={strategies}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingStrategy ? '编辑策略' : '新建策略'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="策略名称" rules={[{ required: true }]}>
            <Input placeholder="请输入策略名称" />
          </Form.Item>
          {!editingStrategy && (
            <>
              <Form.Item name="environmentId" label="环境" rules={[{ required: true }]}>
                <Select placeholder="请选择环境">
                  {environments.map((env) => (
                    <Select.Option key={env.id} value={env.id}>
                      {env.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="cleanupType" label="清理类型" rules={[{ required: true }]}>
                <Select placeholder="请选择清理类型">
                  <Select.Option value="soft_delete">软删除</Select.Option>
                  <Select.Option value="hard_delete">硬删除</Select.Option>
                  <Select.Option value="archive">归档</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="retentionDays" label="保留天数" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
          <Form.Item name="correctionPath" label="修正路径（失败时）">
            <Input.TextArea placeholder="描述清理失败后的修正步骤" rows={3} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Cleanup;
