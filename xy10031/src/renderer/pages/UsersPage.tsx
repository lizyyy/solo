import React, { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tag,
  Popconfirm,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons'
import { ipc } from '../ipc'
import type { User } from '../../types'
import { authStore } from '../store/authStore'

const roleMap = {
  ADMIN: { label: '管理员', color: 'purple' },
  CHECKER: { label: '盘点员', color: 'blue' },
}

function UsersPage() {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [createVisible, setCreateVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const loadUsers = async () => {
    setLoading(true)
    try {
      const result = await ipc.auth.listUsers()
      if (result.success) {
        setUsers(result.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleCreate = async (values: any) => {
    try {
      const result = await ipc.auth.createUser(values)
      if (result.success) {
        message.success('用户创建成功')
        setCreateVisible(false)
        createForm.resetFields()
        loadUsers()
      } else {
        message.error(result.error)
      }
    } catch (err) {
      message.error('创建失败')
    }
  }

  const handleEdit = async (values: any) => {
    if (!currentUser) return
    try {
      const result = await ipc.auth.updateUser(currentUser.id, values)
      if (result.success) {
        message.success('用户更新成功')
        setEditVisible(false)
        loadUsers()
      } else {
        message.error(result.error)
      }
    } catch (err) {
      message.error('更新失败')
    }
  }

  const handleDelete = async (userId: string) => {
    if (userId === authStore.currentUser?.id) {
      message.error('不能删除当前登录用户')
      return
    }
    const result = await ipc.auth.deleteUser(userId)
    if (result.success) {
      message.success('用户已删除')
      loadUsers()
    } else {
      message.error(result.error)
    }
  }

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 150 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 150 },
    { title: '角色', dataIndex: 'role', key: 'role', width: 120,
      render: (v: 'ADMIN' | 'CHECKER') => (
        <Tag color={roleMap[v].color}>{roleMap[v].label}</Tag>
      )},
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 200,
      render: (v: string) => new Date(v).toLocaleString() },
    { title: '操作', key: 'action', width: 200,
      render: (_: any, r: User) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setCurrentUser(r)
            editForm.setFieldsValue({
              name: r.name,
              role: r.role,
            })
            setEditVisible(true)
          }}>编辑</Button>
          <Popconfirm
            title="确定删除该用户?"
            onConfirm={() => handleDelete(r.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
          新建用户
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="新建用户"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => createForm.submit()}
        width={450}
      >
        <Form layout="vertical" form={createForm} onFinish={handleCreate}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<LockOutlined />} placeholder="登录用户名" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="用户真实姓名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="至少6位密码" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]} initialValue="CHECKER">
            <Select>
              <Select.Option value="ADMIN">
                <Tag color="purple">管理员</Tag>
              </Select.Option>
              <Select.Option value="CHECKER">
                <Tag color="blue">盘点员</Tag>
              </Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑用户"
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={() => editForm.submit()}
        width={450}
      >
        <Form layout="vertical" form={editForm} onFinish={handleEdit}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="ADMIN">
                <Tag color="purple">管理员</Tag>
              </Select.Option>
              <Select.Option value="CHECKER">
                <Tag color="blue">盘点员</Tag>
              </Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UsersPage
