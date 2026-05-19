import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Space, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RocketOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { datasetApi } from '../services/api';
import { Dataset } from '../types';

const Datasets: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      setLoading(true);
      const data = await datasetApi.getAll();
      setDatasets(data);
    } catch (error) {
      message.error('加载数据集失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingDataset) {
        await datasetApi.update(editingDataset.id, values);
        message.success('更新成功');
      } else {
        await datasetApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      loadDatasets();
    } catch (error) {
      message.error(editingDataset ? '更新失败' : '创建失败');
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await datasetApi.publish(id);
      message.success('发布成功');
      loadDatasets();
    } catch (error) {
      message.error('发布失败');
    }
  };

  const handleEdit = (record: Dataset) => {
    setEditingDataset(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await datasetApi.delete(id);
      message.success('删除成功');
      loadDatasets();
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
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '导入顺序',
      dataIndex: 'importOrder',
      key: 'importOrder',
      width: 100,
    },
    {
      title: '记录数',
      dataIndex: 'recordCount',
      key: 'recordCount',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          draft: '#faad14',
          published: '#52c41a',
          deprecated: '#999',
        };
        return <span style={{ color: colorMap[status] }}>{status}</span>;
      },
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
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: Dataset) => (
        <Space size="small">
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.status === 'draft' && (
            <Popconfirm title="确认发布该版本?" onConfirm={() => handlePublish(record.id)}>
              <Button icon={<RocketOutlined />} size="small" type="primary">
                发布
              </Button>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除该数据集?" onConfirm={() => handleDelete(record.id)}>
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
        <h2>数据集版本</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingDataset(null);
            form.resetFields();
            setModalVisible(true);
          }}
        >
          新建数据集
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={datasets}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingDataset ? '编辑数据集' : '新建数据集'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="数据集名称" rules={[{ required: true }]}>
            <Input placeholder="请输入数据集名称" />
          </Form.Item>
          <Form.Item name="version" label="版本号" rules={[{ required: true }]}>
            <Input placeholder="如 v1.0.0" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
          <Form.Item name="importOrder" label="导入顺序" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="recordCount" label="记录数量" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select placeholder="请选择状态">
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="published">已发布</Select.Option>
              <Select.Option value="deprecated">已废弃</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Datasets;
