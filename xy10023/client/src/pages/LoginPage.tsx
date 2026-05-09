import { useState } from 'react';
import { Card, Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Navigate } from 'react-router-dom';
import useAuthStore from '@/stores/auth.store';

const { Title } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
}

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<LoginFormValues>();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error) {
      message.error('登录失败，请检查用户名和密码');
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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 400, boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>客服跟进管理系统</Title>
          <Typography.Text type="secondary">请登录以继续</Typography.Text>
        </div>

        <Form
          form={form}
          name="login"
          size="large"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
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

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            支持处理重复提交、多人协作、异步任务编排、事件溯源等复杂场景
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}

export default LoginPage;
