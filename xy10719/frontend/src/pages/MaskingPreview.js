import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Divider,
  Row,
  Col,
  message,
  Collapse,
  Tag
} from 'antd';
import { PlayCircleOutlined, BulbOutlined } from '@ant-design/icons';
import { maskingApi } from '../services/api';

const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

const strategyDescriptions = [
  {
    id: 'mask',
    name: '掩码替换',
    description: '用指定字符掩盖部分内容，保留首尾可见部分。适用于手机号、身份证号等。',
    example: '138****5678'
  },
  {
    id: 'replace',
    name: '完全替换',
    description: '用固定字符串替换全部内容。适用于需要完全隐藏的敏感信息。',
    example: '[REDACTED]'
  },
  {
    id: 'hash',
    name: '哈希处理',
    description: '对内容进行不可逆哈希处理。适用于需要验证但不需要还原的场景。',
    example: 'a1b2c3d4e5f6...'
  },
  {
    id: 'truncate',
    name: '截断处理',
    description: '截断过长的内容。适用于文本内容预览。',
    example: '这是一段很长的文本...'
  },
  {
    id: 'encrypt',
    name: '加密处理',
    description: '对内容进行可逆加密。适用于需要后续还原的敏感信息。',
    example: 'ENCRYPTED:a1b2c3...'
  },
  {
    id: 'none',
    name: '不处理',
    description: '保留原始内容。适用于非敏感信息。',
    example: '原始内容'
  }
];

function MaskingPreview() {
  const [form] = Form.useForm();
  const [strategies, setStrategies] = useState([]);
  const [previewResult, setPreviewResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const response = await maskingApi.getStrategies();
        setStrategies(response.data);
      } catch (error) {
        message.error('获取策略失败');
      }
    };
    fetchStrategies();
  }, []);

  const handlePreview = async (values) => {
    setLoading(true);
    try {
      const response = await maskingApi.preview(values.value, { strategy: values.strategy });
      setPreviewResult(response.data);
      message.success('预览成功');
    } catch (error) {
      message.error('预览失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="脱敏策略配置">
            <Form
              form={form}
              layout="vertical"
              onFinish={handlePreview}
              initialValues={{ strategy: 'mask', value: '13812345678' }}
            >
              <Form.Item
                label="原始值"
                name="value"
                rules={[{ required: true, message: '请输入原始值' }]}
              >
                <TextArea rows={4} placeholder="请输入需要脱敏的原始值" />
              </Form.Item>
              <Form.Item
                label="脱敏策略"
                name="strategy"
                rules={[{ required: true, message: '请选择脱敏策略' }]}
              >
                <Select placeholder="请选择脱敏策略">
                  {strategies.map(s => (
                    <Option key={s.id} value={s.id}>{s.name}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  icon={<PlayCircleOutlined />}
                  loading={loading}
                >
                  预览脱敏效果
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="预览结果">
            {previewResult ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <h4 style={{ marginBottom: 8 }}>原始值</h4>
                  <div
                    style={{
                      padding: 12,
                      background: '#f5f5f5',
                      borderRadius: 4,
                      fontFamily: 'monospace'
                    }}
                  >
                    {previewResult.original}
                  </div>
                </div>
                <Divider style={{ margin: 0 }} />
                <div>
                  <h4 style={{ marginBottom: 8 }}>脱敏后</h4>
                  <div
                    style={{
                      padding: 12,
                      background: '#e6f7ff',
                      borderRadius: 4,
                      fontFamily: 'monospace',
                      border: '1px solid #91d5ff'
                    }}
                  >
                    {previewResult.masked}
                  </div>
                </div>
                <div>
                  <Tag color="blue">策略：{previewResult.strategy}</Tag>
                </div>
              </Space>
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 50 }}>
                请在左侧配置参数并点击"预览脱敏效果"
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="策略说明"
        style={{ marginTop: 16 }}
        extra={<BulbOutlined style={{ color: '#faad14' }} />}
      >
        <Collapse defaultActiveKey={['mask']}>
          {strategyDescriptions.map(s => (
            <Panel header={`${s.name} (${s.id})`} key={s.id}>
              <p style={{ marginBottom: 8 }}>{s.description}</p>
              <p>
                <strong>示例：</strong>
                <code style={{ background: '#f5f5f5', padding: '2px 8px', borderRadius: 4 }}>
                  {s.example}
                </code>
              </p>
            </Panel>
          ))}
        </Collapse>
      </Card>
    </div>
  );
}

export default MaskingPreview;
