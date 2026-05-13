import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Row, Col, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', values);
      login(response.data.token, response.data.user);
      message.success('登录成功');
      navigate('/');
    } catch (error) {
      message.error(error.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row
      justify="center"
      align="middle"
      style={{ minHeight: '100vh', background: '#f0f2f5' }}
    >
      <Col>
        <Card style={{ width: 400, padding: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Title level={2}>实验试剂开封效期管理系统</Title>
            <Text type="secondary">Reagent Expiry Management System</Text>
          </div>

          <Form
            name="login"
            initialValues={{ remember: true }}
            onFinish={onFinish}
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                登录
              </Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: 24, padding: 16, background: '#fafafa', borderRadius: 8 }}>
            <Title level={5}>测试账号：</Title>
            <Text>管理员：admin / 123456</Text><br />
            <Text>操作员：operator / 123456</Text><br />
            <Text>复核员：reviewer / 123456</Text><br />
            <Text>审计员：auditor / 123456</Text>
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default Login;
