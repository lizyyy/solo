import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Form, 
  Select, 
  InputNumber, 
  Input, 
  Button, 
  Space, 
  Alert,
  Descriptions,
  Row,
  Col,
  Statistic,
  message,
  Steps
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import { claimApi, shipmentApi } from '../services/api';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;
const { Step } = Steps;

function ClaimCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shipmentId = searchParams.get('shipmentId');
  
  const [form] = Form.useForm();
  const [shipments, setShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [validation, setValidation] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    loadShipments();
  }, []);

  useEffect(() => {
    if (shipmentId) {
      form.setFieldsValue({ shipmentId: parseInt(shipmentId) });
      handleShipmentChange(parseInt(shipmentId));
    }
  }, [shipments]);

  const loadShipments = async () => {
    try {
      const res = await shipmentApi.list({ page: 1, pageSize: 100 });
      if (res.success) {
        setShipments(res.data);
      }
    } catch (error) {
      console.error('加载运单失败:', error);
    }
  };

  const handleShipmentChange = async (value) => {
    if (!value) return;
    
    try {
      const res = await shipmentApi.getAnalysis(value);
      if (res.success) {
        setSelectedShipment(res.data.shipment);
        setAnalysis(res.data.analysis);
        
        const validateRes = await claimApi.validate({
          shipmentId: value,
          claimType: 'overtemp',
          claimAmount: 0
        });
        
        if (validateRes.success) {
          setValidation(validateRes.data.validation);
          setRecommendation(validateRes.data.recommendation);
          form.setFieldsValue({
            claimAmount: validateRes.data.recommendation?.recommendedAmount || 0,
            overtempSummary: res.data.analysis?.overtempSummary,
            responsibleNode: res.data.analysis?.responsibleNodes?.[0]?.nodeName,
            responsibleParty: res.data.analysis?.responsibleNodes?.[0]?.responsibleParty,
            overtempDuration: res.data.analysis?.totalOvertempMinutes
          });
        }
      }
    } catch (error) {
      console.error('加载运单分析失败:', error);
    }
  };

  const handleValuesChange = async (changedValues, allValues) => {
    if (changedValues.shipmentId) {
      handleShipmentChange(changedValues.shipmentId);
    }
    
    if (changedValues.claimAmount && allValues.shipmentId) {
      const validateRes = await claimApi.validate({
        shipmentId: allValues.shipmentId,
        claimType: allValues.claimType || 'overtemp',
        claimAmount: changedValues.claimAmount
      });
      
      if (validateRes.success) {
        setValidation(validateRes.data.validation);
      }
    }
  };

  const handleSave = async (values) => {
    setLoading(true);
    try {
      const res = await claimApi.create(values);
      if (res.success) {
        message.success('索赔已保存为草稿');
        navigate(`/claims/${res.data.id}`);
      }
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const createRes = await claimApi.create(values);
      if (createRes.success) {
        const submitRes = await claimApi.submit(createRes.data.id, { approverName: '客服' });
        if (submitRes.success) {
          message.success('索赔已提交审批');
          navigate(`/claims/${createRes.data.id}`);
        }
      }
    } catch (error) {
      message.error('提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/claims')}
        >
          返回列表
        </Button>
      </Space>

      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        <Step title="选择运单" />
        <Step title="填写索赔信息" />
        <Step title="提交审批" />
      </Steps>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="新建索赔">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              onValuesChange={handleValuesChange}
            >
              <Form.Item
                name="shipmentId"
                label="选择运单"
                rules={[{ required: true, message: '请选择运单' }]}
              >
                <Select
                  placeholder="请选择运单"
                  showSearch
                  optionFilterProp="children"
                  onChange={handleShipmentChange}
                >
                  {shipments.map(s => (
                    <Option key={s.id} value={s.id}>
                      {s.shipmentNo} - {s.customerName} ({s.cargoType?.name})
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {selectedShipment && (
                <Card size="small" style={{ marginBottom: 16 }} type="inner" title="运单信息">
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="运单号">{selectedShipment.shipmentNo}</Descriptions.Item>
                    <Descriptions.Item label="客户">{selectedShipment.customerName}</Descriptions.Item>
                    <Descriptions.Item label="货物类型">{selectedShipment.cargoType?.name}</Descriptions.Item>
                    <Descriptions.Item label="货值">¥{selectedShipment.cargoValue?.toLocaleString()}</Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              {validation && validation.issues.length > 0 && (
                <Alert
                  message="存在问题"
                  description={validation.issues.map((issue, i) => (
                    <div key={i}>{issue.message}</div>
                  ))}
                  type="error"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              {validation && validation.warnings.length > 0 && (
                <Alert
                  message="警告"
                  description={validation.warnings.map((warning, i) => (
                    <div key={i}>{warning.message}</div>
                  ))}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="claimType"
                    label="索赔类型"
                    initialValue="overtemp"
                    rules={[{ required: true, message: '请选择索赔类型' }]}
                  >
                    <Select>
                      <Option value="overtemp">超温索赔</Option>
                      <Option value="damaged">货损索赔</Option>
                      <Option value="lost">丢失索赔</Option>
                      <Option value="other">其他</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="claimAmount"
                    label="索赔金额(元)"
                    rules={[{ required: true, message: '请输入索赔金额' }]}
                  >
                    <InputNumber 
                      style={{ width: '100%' }} 
                      min={0}
                      precision={2}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="claimReason"
                label="索赔原因"
                rules={[{ required: true, message: '请输入索赔原因' }]}
              >
                <TextArea rows={3} placeholder="请详细描述索赔原因" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="responsibleNode"
                    label="责任节点"
                  >
                    <Input placeholder="系统自动识别" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="responsibleParty"
                    label="责任方"
                  >
                    <Input placeholder="系统自动识别" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="overtempSummary"
                label="超温摘要"
              >
                <TextArea rows={2} placeholder="系统自动生成" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button 
                    type="primary" 
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={loading}
                  >
                    保存草稿
                  </Button>
                  <Button 
                    type="primary"
                    danger={validation && !validation.isValid}
                    icon={<SendOutlined />}
                    loading={loading}
                    onClick={async () => {
                      try {
                        const values = await form.validateFields();
                        await handleSubmit(values);
                      } catch (error) {
                        console.error('验证失败:', error);
                      }
                    }}
                  >
                    提交审批
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={8}>
          {recommendation && (
            <Card title="系统建议">
              <Statistic
                title="建议赔付金额"
                value={recommendation.recommendedAmount}
                prefix="¥"
                precision={2}
                valueStyle={{ color: '#1890ff', fontSize: 24 }}
              />
              <div style={{ marginTop: 16, color: '#666' }}>
                <p>最高赔付限额：¥{recommendation.maxAllowed?.toLocaleString()}</p>
                <p>赔付比例：{(recommendation.ratio * 100).toFixed(0)}%</p>
                {recommendation.overMinutes > 0 && (
                  <p>超温时长：{recommendation.overMinutes}分钟</p>
                )}
                {recommendation.maxTempDeviation > 0 && (
                  <p>最大温度偏差：{recommendation.maxTempDeviation.toFixed(1)}℃</p>
                )}
              </div>
            </Card>
          )}

          {analysis && (
            <Card title="温度分析摘要" style={{ marginTop: 16 }}>
              <div style={{ color: '#666' }}>
                <p>{analysis.overtempSummary}</p>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}

export default ClaimCreate;
