import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await authApi.login(values.email, values.password);
      const { user, token } = response.data.data;
      login(user, token);
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error) {
      console.error('登录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <div className="login-title">
          <h2>活动报名管理系统</h2>
          <p>Activity Registration System</p>
        </div>
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="邮箱"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
            >
              登录
            </Button>
          </Form.Item>

          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#999' }}>
            <p>测试账号：</p>
            <p>admin@example.com / admin123 (管理员)</p>
            <p>manager@example.com / manager123 (经理)</p>
            <p>operator@example.com / operator123 (运营)</p>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
