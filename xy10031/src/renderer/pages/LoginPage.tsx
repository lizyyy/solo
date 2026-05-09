import React, { useState } from 'react'
import { Card, Form, Input, Button, message, Typography, Alert } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { authStore } from '../store/authStore'

const { Title, Text } = Typography

interface LoginPageProps {
  onLogin: () => void
}

function LoginPage({ onLogin }: LoginPageProps) {
  const [loading, setLoading] = useState(false)

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const result = await authStore.login(values.username, values.password)
      if (result.success) {
        message.success('登录成功')
        onLogin()
      } else {
        message.error(result.error || '登录失败')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>仓库盘点管理系统</Title>
          <Text type="secondary">请登录您的账户</Text>
        </div>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <div>
              <div><strong>管理员:</strong> admin / admin123</div>
              <div><strong>盘点员:</strong> checker1 / checker123</div>
            </div>
          }
        />

        <Form
          onFinish={handleLogin}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" size="large" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default LoginPage
