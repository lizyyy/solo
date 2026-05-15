import React, { useEffect, useState } from 'react';
import { Card, List, Button, Space, Tag, message, Modal, Form, Input, Select, Divider } from 'antd';
import { PlusOutlined, ApiOutlined, ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { TextArea } = Input;

function Settings() {
  const [exceptions, setExceptions] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchExceptions = async () => {
    try {
      const res = await axios.get('/api/exceptions');
      if (res.data.success) {
        setExceptions(res.data.data);
      }
    } catch (error) {
      message.error('获取异常模板失败');
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, []);

  const handleAddException = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      let responseBody = values.responseBody;
      try {
        responseBody = JSON.parse(values.responseBody);
      } catch (e) {
        // 保持原样
      }
      
      await axios.post('/api/exceptions', { ...values, responseBody });
      message.success('创建成功');
      setModalVisible(false);
      fetchExceptions();
    } catch (error) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const testReplay = async (path, method) => {
    try {
      const res = await axios({ method, url: `/api/replay${path}` });
      message.success(`请求成功，状态码: ${res.status}`);
      console.log('响应数据:', res.data);
    } catch (error) {
      message.success(`请求返回状态码: ${error.response?.status || error.message}`);
      console.log('响应数据:', error.response?.data);
    }
  };

  const testCases = [
    { name: '获取用户信息 - 成功', path: '/api/user', method: 'GET', icon: <ApiOutlined /> },
    { name: '获取用户信息 - 未授权', path: '/api/user', method: 'GET', headers: { Authorization: '' }, icon: <ThunderboltOutlined /> },
    { name: '创建订单 - 成功', path: '/api/order', method: 'POST', icon: <ApiOutlined /> },
    { name: '创建订单 - 重复提交', path: '/api/order', method: 'POST', headers: { 'X-Idempotency-Key': 'duplicate' }, icon: <ThunderboltOutlined /> },
    { name: '支付接口 - 余额不足', path: '/api/payment', method: 'POST', data: { amount: 1000 }, icon: <ThunderboltOutlined /> },
  ];

  return (
    <div>
      <Card title="快速测试" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ color: '#666', marginBottom: 16 }}>
            点击下面的按钮测试回放接口效果，结果将在控制台输出：
          </div>
          <List
            grid={{ gutter: 16, column: 2 }}
            dataSource={testCases}
            renderItem={(item) => (
              <List.Item>
                <Card size="small">
                  <Space>
                    {item.icon}
                    <span>{item.name}</span>
                    <Tag>{item.method}</Tag>
                    <Button
                      type="primary"
                      size="small"
                      onClick={async () => {
                        try {
                          const config = { method: item.method, url: `/api/replay${item.path}` };
                          if (item.headers) config.headers = item.headers;
                          if (item.data) config.data = item.data;
                          const res = await axios(config);
                          message.success(`状态码: ${res.status}`);
                          console.log('响应:', res.data);
                        } catch (error) {
                          message.info(`状态码: ${error.response?.status}`);
                          console.log('响应:', error.response?.data);
                        }
                      }}
                    >
                      测试
                    </Button>
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        </Space>
      </Card>

      <Card
        title="异常模板管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddException}>
            新建模板
          </Button>
        }
      >
        <List
          dataSource={exceptions}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Tag color={item.statusCode >= 500 ? 'red' : 'orange'}>{item.statusCode}</Tag>}
                title={
                  <Space>
                    {item.name}
                    <Tag>{item.type}</Tag>
                  </Space>
                }
                description={
                  <div>
                    <div>{item.description}</div>
                    <pre style={{ fontSize: '12px', background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 8, maxHeight: 150, overflow: 'auto' }}>
                      {JSON.stringify(item.responseBody, null, 2)}
                    </pre>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="新建异常模板"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="例如：系统维护中" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select>
              <Option value="maintenance">系统维护</Option>
              <Option value="rate_limit">限流</Option>
              <Option value="database">数据库错误</Option>
              <Option value="business">业务异常</Option>
              <Option value="network">网络异常</Option>
            </Select>
          </Form.Item>
          <Form.Item name="statusCode" label="HTTP 状态码" rules={[{ required: true }]}>
            <Input type="number" placeholder="例如：503" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="简短描述" />
          </Form.Item>
          <Form.Item name="responseBody" label="响应体 (JSON)" rules={[{ required: true }]}>
            <TextArea rows={6} placeholder='{"success": false, "error": "ServiceUnavailable", "message": "系统维护中"}' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Settings;
