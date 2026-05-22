import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { LoginResponse } from '../../shared/types.js';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore(state => state.login);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const result = await apiClient.post<LoginResponse>('/auth/login', values);
      login(result.token, result.user);
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error) {
      console.error('登录失败:', error);
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
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)'
    }}>
      <Card 
        style={{ 
          width: 400, 
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          borderRadius: 8
        }}
        title={
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: 0, color: '#1e3a5f' }}>物业维修异常回执系统</h2>
            <p style={{ margin: '8px 0 0', color: '#666', fontSize: 14 }}>请登录您的账号</p>
          </div>
        }
      >
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
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

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              loading={loading}
              style={{ 
                background: '#1e3a5f',
                borderColor: '#1e3a5f',
                height: 44
              }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: '#f5f5f5', 
          borderRadius: 4,
          fontSize: 12,
          color: '#666'
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 'bold' }}>测试账号（密码均为 123456）：</p>
          <div>客服：cs001 | 师傅：tech001 | 复核：review001</div>
          <div>项目经理：pm001 | 财务：finance001</div>
        </div>
      </Card>
    </div>
  );
};

export default Login;
