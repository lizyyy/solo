import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, Select, Space, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { collections, environments, executions } from '../services/api';

function Collections() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [envOptions, setEnvOptions] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [collectionsRes, envRes] = await Promise.all([
        collections.getAll(),
        environments.getAll(),
      ]);
      setData(collectionsRes.data);
      setEnvOptions(envRes.data.map(e => ({ label: e.name, value: e.id })));
    } catch (error) {
      message.error('加载数据失败');
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个巡检集合吗？',
      onOk: async () => {
        try {
          await collections.delete(id);
          message.success('删除成功');
          loadData();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await collections.update(editingItem.id, values);
        message.success('更新成功');
      } else {
        await collections.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleRun = async (record) => {
    try {
      const res = await executions.runCollection(record.id);
      message.success('执行已开始');
      navigate(`/batches/${res.data.batchId}`);
    } catch (error) {
      message.error('启动执行失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <a onClick={() => navigate(`/collections/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '步骤数',
      dataIndex: 'step_count',
      key: 'step_count',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleRun(record)}
          >
            执行
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="巡检集合"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建集合
        </Button>
      }
    >
      <Table columns={columns} dataSource={data} rowKey="id" />

      <Modal
        title={editingItem ? '编辑集合' : '新建集合'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入集合名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
          <Form.Item name="environment_id" label="环境">
            <Select placeholder="选择环境" options={envOptions} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              placeholder="选择状态"
              options={[
                { label: '启用', value: 'active' },
                { label: '停用', value: 'inactive' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default Collections;
