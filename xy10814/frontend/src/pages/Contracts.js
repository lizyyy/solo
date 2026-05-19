import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Card, Modal, Form, Input, Select, Switch, message, Tag, Popconfirm, Divider, List, Badge } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [sceneModalVisible, setSceneModalVisible] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [form] = Form.useForm();
  const [sceneForm] = Form.useForm();

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/contracts');
      if (res.data.success) {
        setContracts(res.data.data);
      }
    } catch (error) {
      message.error('获取合约列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchScenes = async (contractId) => {
    try {
      const res = await axios.get('/api/scenes', { params: { contractId } });
      if (res.data.success) {
        setScenes(res.data.data);
      }
    } catch (error) {
      message.error('获取场景列表失败');
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const handleAdd = () => {
    setEditingContract(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingContract(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/contracts/${id}`);
      message.success('删除成功');
      fetchContracts();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingContract) {
        await axios.put(`/api/contracts/${editingContract.id}`, values);
        message.success('更新成功');
      } else {
        await axios.post('/api/contracts', values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchContracts();
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleManageScenes = (record) => {
    setSelectedContract(record);
    fetchScenes(record.id);
    setSceneModalVisible(true);
  };

  const handleToggleScene = async (id) => {
    try {
      await axios.patch(`/api/scenes/${id}/toggle`);
      message.success('状态已更新');
      fetchScenes(selectedContract.id);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSetDefaultScene = async (id) => {
    try {
      await axios.patch(`/api/scenes/${id}/set-default`);
      message.success('已设为默认场景');
      fetchScenes(selectedContract.id);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '合约名称',
      dataIndex: 'name',
      key: 'name',
      width: 200
    },
    {
      title: '请求路径',
      dataIndex: 'path',
      key: 'path',
      width: 200,
      render: (text) => <code>{text}</code>
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active) => (
        <Badge status={active ? 'success' : 'default'} text={active ? '启用' : '禁用'} />
      )
    },
    {
      title: '场景数量',
      key: 'scenes',
      width: 100,
      render: (_, record) => record.scenes?.length || 0
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => handleManageScenes(record)}>
            场景
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="合约管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建合约
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={contracts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingContract ? '编辑合约' : '新建合约'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="合约名称" rules={[{ required: true }]}>
            <Input placeholder="请输入合约名称" />
          </Form.Item>
          <Form.Item name="path" label="请求路径" rules={[{ required: true }]}>
            <Input placeholder="/api/user" />
          </Form.Item>
          <Form.Item name="method" label="请求方法" rules={[{ required: true }]} initialValue="GET">
            <Select>
              <Option value="GET">GET</Option>
              <Option value="POST">POST</Option>
              <Option value="PUT">PUT</Option>
              <Option value="DELETE">DELETE</Option>
              <Option value="PATCH">PATCH</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="environment" label="环境" initialValue="development">
            <Select>
              <Option value="development">开发</Option>
              <Option value="testing">测试</Option>
              <Option value="production">生产</Option>
            </Select>
          </Form.Item>
          <Form.Item name="isActive" label="启用状态" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`场景管理 - ${selectedContract?.name}`}
        open={sceneModalVisible}
        onCancel={() => setSceneModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setSceneModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <List
          dataSource={scenes}
          renderItem={(scene) => (
            <List.Item
              actions={[
                <Button
                  size="small"
                  type={scene.isEnabled ? 'primary' : 'default'}
                  onClick={() => handleToggleScene(scene.id)}
                >
                  {scene.isEnabled ? '启用' : '禁用'}
                </Button>,
                !scene.isDefault && (
                  <Button size="small" onClick={() => handleSetDefaultScene(scene.id)}>
                    设为默认
                  </Button>
                )
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {scene.name}
                    {scene.isDefault && <Tag color="gold">默认</Tag>}
                  </Space>
                }
                description={
                  <div>
                    <div>HTTP 状态码: {scene.statusCode}</div>
                    {scene.delayConfig?.enabled && (
                      <div>响应延迟: {scene.delayConfig.fixedDelay || `${scene.delayConfig.minDelay}-${scene.delayConfig.maxDelay}`}ms</div>
                    )}
                    {scene.matchRules?.length > 0 && (
                      <div>
                        匹配规则:
                        <ul>
                          {scene.matchRules.map((rule, idx) => (
                            <li key={idx}>
                              {rule.type}.{rule.key} {rule.operator} {rule.value || '(存在即可)'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}

export default Contracts;
