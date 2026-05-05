import React, { useState } from 'react';
import { 
  Form, 
  Input, 
  Select, 
  InputNumber, 
  Switch, 
  Button, 
  Card, 
  Space,
  Row,
  Col,
  Divider,
  Alert
} from 'antd';
import { 
  ThunderboltOutlined, 
  ClockCircleOutlined,
  WifiOutlined,
  ReloadOutlined,
  SafetyOutlined
} from '@ant-design/icons';

const { Option } = Select;

const ExperimentConfig = ({ onSubmit, onCancel, loading }) => {
  const [form] = Form.useForm();
  const [protocol, setProtocol] = useState('TCP');

  const handleValuesChange = (changedValues, allValues) => {
    if (changedValues.protocol) {
      setProtocol(changedValues.protocol);
    }
  };

  const handleSubmit = async (values) => {
    await onSubmit(values);
    form.resetFields();
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      onValuesChange={handleValuesChange}
      initialValues={{
        protocol: 'TCP',
        clientCount: 1,
        sendInterval: 1000,
        messageDelimiter: '\n',
        heartbeatInterval: 5000,
        timeoutThreshold: 30000,
        reconnectStrategy: 'exponential_backoff',
        maxReconnectAttempts: 5,
        enableStickyPacketDemo: false,
        enableOutOfOrderDemo: false,
        lossRate: 0,
        enableNagle: false
      }}
    >
      <Alert
        message={
          <span>
            当前模拟 <strong>{protocol}</strong> 协议，
            {protocol === 'TCP' 
              ? '演示连接建立/关闭、字节流粘包拆包、心跳保活、超时断开、指数退避重连' 
              : '演示数据报边界、丢包、乱序、不可靠传输特性'}
          </span>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card size="small" title="基本配置">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item 
              name="name" 
              label="实验名称"
              rules={[{ required: true, message: '请输入实验名称' }]}
            >
              <Input placeholder="例如：TCP 三次握手演示" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item 
              name="protocol" 
              label="协议类型"
              rules={[{ required: true, message: '请选择协议类型' }]}
            >
              <Select>
                <Option value="TCP">TCP (传输控制协议)</Option>
                <Option value="UDP">UDP (用户数据报协议)</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card 
        size="small" 
        title={
          <Space>
            <WifiOutlined />
            连接配置
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="clientCount" label="客户端数量">
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="sendInterval" label="发送间隔 (ms)">
              <InputNumber min={100} max={10000} step={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="messageDelimiter" label="消息分隔符">
              <Select>
                <Option value="\n">换行符 (\n)</Option>
                <Option value=",">逗号 (,)</Option>
                <Option value=";">分号 (;)</Option>
                <Option value="|">竖线 (|)</Option>
                <Option value="">无分隔符</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {protocol === 'TCP' && (
        <>
          <Card 
            size="small" 
            title={
              <Space>
                <ClockCircleOutlined />
                保活与超时
              </Space>
            }
            style={{ marginTop: 16 }}
          >
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="heartbeatInterval" label="心跳间隔 (ms)">
                  <InputNumber min={1000} max={60000} step={1000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="timeoutThreshold" label="超时阈值 (ms)">
                  <InputNumber min={5000} max={120000} step={5000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="enableNagle" valuePropName="checked" label="启用 Nagle 算法">
                  <Switch checkedChildren="是" unCheckedChildren="否" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card 
            size="small" 
            title={
              <Space>
                <ReloadOutlined />
                重连策略
              </Space>
            }
            style={{ marginTop: 16 }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="reconnectStrategy" label="重连策略">
                  <Select>
                    <Option value="exponential_backoff">指数退避 (推荐)</Option>
                    <Option value="fixed_interval">固定间隔</Option>
                    <Option value="immediate">立即重连</Option>
                    <Option value="none">不重连</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="maxReconnectAttempts" label="最大重连次数">
                  <InputNumber min={0} max={20} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card 
            size="small" 
            title={
              <Space>
                <ThunderboltOutlined />
                演示选项
              </Space>
            }
            style={{ marginTop: 16 }}
          >
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="enableStickyPacketDemo" valuePropName="checked" label="粘包拆包演示">
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </>
      )}

      {protocol === 'UDP' && (
        <Card 
          size="small" 
          title={
            <Space>
              <SafetyOutlined />
              不可靠传输演示
            </Space>
          }
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="lossRate" label="丢包率 (%)">
                <InputNumber min={0} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="enableOutOfOrderDemo" valuePropName="checked" label="乱序演示">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )}

      <Divider />

      <Form.Item>
        <Space style={{ float: 'right' }}>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            创建实验
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default ExperimentConfig;
