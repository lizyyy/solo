import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Alert,
  Tag,
  Descriptions,
  Divider,
  Typography,
  message,
  Spin,
  Row,
  Col,
} from 'antd';
import {
  SafetyOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { riskApi } from '../services/api';
import { RiskCheckResult, RiskLevel } from '../types';
import { v4 as uuidv4 } from 'uuid';

const { Title, Text } = Typography;

const RiskTest: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskCheckResult | null>(null);
  const [testHistory, setTestHistory] = useState<Array<{ time: Date; promoCode: string; result: RiskCheckResult }>>([]);

  const handleTest = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const response = await riskApi.checkRisk({
        promoCode: values.promoCode,
        deviceId: values.deviceId || uuidv4(),
        userId: values.userId,
        ipAddress: values.ipAddress || '127.0.0.1',
        userAgent: values.userAgent || navigator.userAgent,
      });

      if (response.data.success) {
        const resultData = response.data.data!;
        setResult(resultData);
        setTestHistory(prev => [
          { time: new Date(), promoCode: values.promoCode, result: resultData },
          ...prev.slice(0, 9),
        ]);
        message.success(resultData.allowed ? '放行 - 风控检查通过' : '拦截 - 触发风控规则');
      }
    } catch (err: any) {
      message.error('测试失败');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.CRITICAL:
      case RiskLevel.HIGH:
        return 'red';
      case RiskLevel.MEDIUM:
        return 'orange';
      default:
        return 'green';
    }
  };

  const getResultIcon = (allowed: boolean) => {
    if (allowed) {
      return <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />;
    }
    return <StopOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />;
  };

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <SafetyOutlined /> 风控规则测试
      </Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <Card title="测试参数" className="stat-card">
            <Form form={form} layout="vertical">
              <Form.Item
                name="promoCode"
                label="优惠码"
                rules={[{ required: true, message: '请输入优惠码' }]}
                extra="例如: SAVE20, FIXED50 等"
              >
                <Input placeholder="请输入优惠码" />
              </Form.Item>

              <Form.Item
                name="deviceId"
                label="设备ID"
                extra="留空将自动生成随机ID"
              >
                <Input placeholder="设备唯一标识符" />
              </Form.Item>

              <Form.Item
                name="userId"
                label="用户ID"
                extra="可选"
              >
                <Input placeholder="用户标识符" />
              </Form.Item>

              <Form.Item
                name="ipAddress"
                label="IP地址"
                extra="默认为 127.0.0.1"
              >
                <Input placeholder="192.168.1.1" />
              </Form.Item>

              <Form.Item
                name="userAgent"
                label="User-Agent"
                extra="默认为当前浏览器UA"
              >
                <Input.TextArea rows={2} placeholder="浏览器用户代理" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button type="primary" onClick={handleTest} loading={loading} icon={<SafetyOutlined />}>
                    执行风控检查
                  </Button>
                  <Button onClick={() => { form.resetFields(); setResult(null); }} icon={<ReloadOutlined />}>
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>

          {testHistory.length > 0 && (
            <Card title="测试历史" style={{ marginTop: 24 }} className="stat-card">
              {testHistory.map((item, idx) => (
                <div key={idx} style={{ padding: '8px 0', borderBottom: idx < testHistory.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <Space>
                    <Tag color={item.result.allowed ? 'green' : 'red'}>
                      {item.result.allowed ? '放行' : '拦截'}
                    </Tag>
                    <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                      {item.promoCode}
                    </code>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.time.toLocaleTimeString()}
                    </Text>
                  </Space>
                </div>
              ))}
            </Card>
          )}
        </Col>

        <Col xs={24} md={12}>
          <Card title="检查结果" className="stat-card">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>正在执行风控检查...</div>
              </div>
            ) : result ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  {getResultIcon(result.allowed)}
                  <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 16, color: result.allowed ? '#52c41a' : '#ff4d4f' }}>
                    {result.allowed ? '风控检查通过 - 已放行' : '触发风控规则 - 已拦截'}
                  </div>
                </div>

                <Alert
                  message="风控说明"
                  description={result.reason || '正常放行，未触发任何风险规则'}
                  type={result.allowed ? 'success' : 'warning'}
                  showIcon
                  style={{ marginBottom: 24 }}
                />

                <Divider style={{ margin: '16px 0' }} />

                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="风险评分">
                    <span style={{
                      fontSize: 20,
                      fontWeight: 'bold',
                      color: result.riskScore >= 60 ? '#ff4d4f' : result.riskScore >= 30 ? '#fa8c16' : '#52c41a',
                    }}>
                      {result.riskScore}
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}> / 100</span>
                  </Descriptions.Item>
                  <Descriptions.Item label="风险等级">
                    <Tag color={getRiskLevelColor(result.riskLevel)} style={{ fontSize: 14, padding: '4px 12px' }}>
                      {result.riskLevel.toUpperCase()}
                    </Tag>
                  </Descriptions.Item>
                  {result.triggeredRules && result.triggeredRules.length > 0 && (
                    <Descriptions.Item label="触发规则">
                      <Space wrap>
                        {result.triggeredRules.map((rule, idx) => (
                          <Tag key={idx} color="red">{rule}</Tag>
                        ))}
                      </Space>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                <SafetyOutlined style={{ fontSize: 64, marginBottom: 16, opacity: 0.3 }} />
                <div>请在左侧输入参数并执行风控检查</div>
              </div>
            )}
          </Card>

          <Card title="风控规则说明" style={{ marginTop: 24 }} className="stat-card">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="1. 频率限制规则">
                <Text type="secondary">5分钟内尝试次数超过3次，加30分</Text>
              </Descriptions.Item>
              <Descriptions.Item label="2. 重复使用检测">
                <Text type="secondary">同一设备多次使用同一优惠码，加40分</Text>
              </Descriptions.Item>
              <Descriptions.Item label="3. 设备指纹识别">
                <Text type="secondary">可疑设备累计尝试超过10次，加50分</Text>
              </Descriptions.Item>
              <Descriptions.Item label="4. 风险评分阈值">
                <Text type="secondary">累计评分 ≥ 60分，触发拦截</Text>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16, padding: 12, background: '#f6ffed', borderRadius: 4 }}>
              <Text type="success" strong>测试提示：</Text>
              <Text type="success" style={{ display: 'block', marginTop: 4 }}>
                快速连续使用相同设备ID测试，会触发频率限制规则，观察风险评分变化。
              </Text>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RiskTest;
