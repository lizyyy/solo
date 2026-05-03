import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Tag,
  Popconfirm,
  message,
  Card,
  Row,
  Col
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UserOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

const REGIONS = ['CN', 'US', 'JP', 'UK', 'DE', 'FR', 'IN', 'BR'];
const ACCOUNT_TYPES = ['free', 'pro', 'enterprise', 'trial'];
const AVAILABLE_TAGS = ['new_user', 'active', 'inactive', 'premium', 'beta_tester', 'early_adopter'];

function UsersPage({ onRefresh }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getAll();
      setUsers(data);
    } catch (error) {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingUser(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(id);
      message.success('删除成功');
      loadUsers();
      if (onRefresh) onRefresh();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingUser) {
        await api.update(editingUser.id, values);
        message.success('更新成功');
      } else {
        await api.create(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      loadUsers();
      if (onRefresh) onRefresh();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: '地区',
      dataIndex: 'region',
      key: 'region',
      render: (region) => (
        <Tag color="blue">{region}</Tag>
      )
    },
    {
      title: '账号类型',
      dataIndex: 'accountType',
      key: 'accountType',
      render: (type) => {
        const colorMap = {
          free: 'default',
          pro: 'gold',
          enterprise: 'purple',
          trial: 'cyan'
        };
        return <Tag color={colorMap[type] || 'default'}>{type}</Tag>;
      }
    },
    {
      title: '注册天数',
      dataIndex: 'registerDays',
      key: 'registerDays',
      render: (days) => `${days} 天`
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags) => (
        <Space wrap>
          {(tags || []).map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
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
        title={
          <Space>
            <UserOutlined />
            用户样本管理
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadUsers}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              添加用户
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="region"
                label="地区"
                rules={[{ required: true, message: '请选择地区' }]}
              >
                <Select placeholder="请选择地区">
                  {REGIONS.map(region => (
                    <Option key={region} value={region}>{region}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="accountType"
                label="账号类型"
                rules={[{ required: true, message: '请选择账号类型' }]}
              >
                <Select placeholder="请选择账号类型">
                  {ACCOUNT_TYPES.map(type => (
                    <Option key={type} value={type}>{type}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="registerDays"
            label="注册天数"
            rules={[{ required: true, message: '请输入注册天数' }]}
          >
            <InputNumber
              min={0}
              max={3650}
              style={{ width: '100%' }}
              placeholder="请输入注册天数"
            />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="选择或输入标签"
              style={{ width: '100%' }}
              options={AVAILABLE_TAGS.map(tag => ({ label: tag, value: tag }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default UsersPage;
