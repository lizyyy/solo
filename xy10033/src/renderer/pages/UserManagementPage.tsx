import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Space
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { User, UserRole } from '../../shared/types';
import { hasPermission } from '../hooks/useAuth';

const { Option } = Select;

interface UserManagementPageProps {
  currentUser: Omit<User, 'password'>;
}

const roleLabels: Record<string, string> = {
  [UserRole.ADMIN]: '管理员',
  [UserRole.CUSTOMER_SERVICE]: '客服',
  [UserRole.NORMAL]: '普通用户'
};

const roleColors: Record<string, string> = {
  [UserRole.ADMIN]: 'red',
  [UserRole.CUSTOMER_SERVICE]: 'blue',
  [UserRole.NORMAL]: 'default'
};

const UserManagementPage: React.FC<UserManagementPageProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<Array<Omit<User, 'password'>>>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<Omit<User, 'password'> | null>(null);
  const [form] = Form.useForm();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.user.list();
      if (result.success) {
        setUsers(result.data);
      }
    } catch (error) {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (values: any) => {
    try {
      if (editingUser) {
        const updateData: Partial<User> = {
          name: values.name,
          role: values.role
        };
        if (values.password) {
          updateData.password = values.password;
        }
        const result = await window.electronAPI.user.update(editingUser.id, updateData);
        if (result.success) {
          message.success('更新用户成功');
        }
      } else {
        const result = await window.electronAPI.user.create(values);
        if (result.success) {
          message.success('创建用户成功');
        }
      }
      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      loadUsers();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await window.electronAPI.user.delete(id);
      if (result.success) {
        message.success('删除成功');
        loadUsers();
      }
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 150
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 150
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: UserRole) => (
        <Select.Option value={role}>{roleLabels[role]}</Select.Option>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 200,
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: Omit<User, 'password'>) => (
        <Space size="small">
          {hasPermission(currentUser, 'user.update') && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingUser(record);
                form.setFieldsValue({
                  username: record.username,
                  name: record.name,
                  role: record.role
                });
                setModalVisible(true);
              }}
            >
              编辑
            </Button>
          )}
          {hasPermission(currentUser, 'user.delete') && record.id !== currentUser.id && (
            <Popconfirm
              title="确定删除该用户吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2>用户管理</h2>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadUsers}
          >
            刷新
          </Button>
          {hasPermission(currentUser, 'user.create') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingUser(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              新建用户
            </Button>
          )}
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {!editingUser ? (
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>
          ) : (
            <Form.Item label="用户名">
              <Input value={editingUser.username} disabled />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name={editingUser ? 'password' : 'password'}
            label={editingUser ? '新密码（留空不修改）' : '密码'}
            rules={editingUser ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editingUser ? '请输入新密码' : '请输入密码'} />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Option value={UserRole.ADMIN}>管理员</Option>
              <Option value={UserRole.CUSTOMER_SERVICE}>客服</Option>
              <Option value={UserRole.NORMAL}>普通用户</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagementPage;
