import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined, FileTextOutlined } from '@ant-design/icons';
import { login } from '../services/api';

function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const response = await login(values.username, values.password);
      if (response.success) {
        message.success('登录成功');
        onLogin(response.user);
      } else {
        message.error(response.message || '登录失败');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card
        style={{
          width: 400,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderRadius: 12
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <FileTextOutlined style={{ fontSize: 32, color: 'white' }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Offer 变更审批台</h1>
          <p style={{ color: '#666', margin: 0 }}>招聘 Offer 全生命周期管理系统</p>
        </div>

        <Form
          name="login"
          initialValues={{ username: 'hr_admin', password: 'password123' }}
          onFinish={handleSubmit}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 48, fontSize: 16 }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{
          marginTop: 24,
          padding: 12,
          background: '#f5f5f5',
          borderRadius: 8,
          fontSize: 12,
          color: '#666'
        }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>演示账号：</div>
          <div>HR管理员: hr_admin / password123</div>
          <div>部门经理: manager1 / password123</div>
          <div>总监: director / password123</div>
        </div>
      </Card>
    </div>
  );
}

export default Login;
