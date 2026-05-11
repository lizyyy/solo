import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Row,
  Col,
  Statistic,
  Alert,
  Steps,
  Tag,
  Divider,
  Radio,
  message,
  Spin,
  Checkbox
} from 'antd';
import {
  FileExcelOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  SearchOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { reportApi, logApi } from '../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Step } = Steps;

const ANOMALY_TYPES = [
  { value: 'DUPLICATE', label: '重复操作' },
  { value: 'CONCURRENCY', label: '并发冲突' },
  { value: 'TIMING_ISSUE', label: '时序问题' },
  { value: 'CACHE_STALE', label: '缓存问题' },
  { value: 'ROLLBACK_FAILED', label: '回滚失败' },
  { value: 'ASYNC_OUT_OF_ORDER', label: '异步错乱' }
];

const ReportGenerator = () => {
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState('json');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const generateMutation = useMutation(
    (data) => reportApi.generate(data),
    {
      onSuccess: (response, variables) => {
        if (variables.format === 'json') {
          message.success('报告生成成功');
          queryClient.invalidateQueries(['reports']);
          navigate('/reports');
        } else {
          const blob = new Blob([response.data]);
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          const extensions = { excel: 'csv', markdown: 'md', pdf: 'pdf' };
          link.href = url;
          link.setAttribute('download', `report.${extensions[variables.format]}`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          message.success('报告下载成功');
        }
      },
      onError: () => {
        message.error('报告生成失败');
      }
    }
  );

  const previewMutation = useMutation(
    (filters) => reportApi.preview(filters),
    {
      onSuccess: (response) => {
        setPreview(response.data.data);
        setStep(1);
      },
      onError: () => {
        message.error('预览生成失败');
      }
    }
  );

  const handlePreview = async (values) => {
    const filters = {};
    
    if (values.timeRange && values.timeRange.length === 2) {
      filters.startTime = values.timeRange[0].toISOString();
      filters.endTime = values.timeRange[1].toISOString();
    }
    if (values.level) filters.level = values.level;
    if (values.service) filters.service = values.service;
    if (values.userId) filters.userId = values.userId;
    if (values.traceId) filters.traceId = values.traceId;
    if (values.anomalies && values.anomalies.length > 0) {
      filters.anomalies = values.anomalies;
    }

    previewMutation.mutate(filters);
  };

  const handleGenerate = () => {
    const values = form.getFieldsValue();
    const filters = {};
    
    if (values.timeRange && values.timeRange.length === 2) {
      filters.startTime = values.timeRange[0].toISOString();
      filters.endTime = values.timeRange[1].toISOString();
    }
    if (values.level) filters.level = values.level;
    if (values.service) filters.service = values.service;
    if (values.userId) filters.userId = values.userId;
    if (values.traceId) filters.traceId = values.traceId;
    if (values.anomalies && values.anomalies.length > 0) {
      filters.anomalies = values.anomalies;
    }

    generateMutation.mutate({
      ...filters,
      format: selectedFormat,
      createdBy: 'user'
    });
  };

  const formatIcons = {
    excel: <FileExcelOutlined style={{ color: '#217346' }} />,
    markdown: <FileTextOutlined style={{ color: '#083fa1' }} />,
    pdf: <FilePdfOutlined style={{ color: '#ff0000' }} />,
    json: <FileTextOutlined style={{ color: '#f7df1e' }} />
  };

  return (
    <div>
      <Button 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate('/reports')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      <Card>
        <Steps current={step} style={{ marginBottom: 24 }}>
          <Step title="设置筛选条件" />
          <Step title="预览数据" />
          <Step title="导出报告" />
        </Steps>

        {step === 0 && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handlePreview}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="timeRange" label="时间范围">
                  <RangePicker 
                    showTime 
                    style={{ width: '100%' }}
                    format="YYYY-MM-DD HH:mm:ss"
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="level" label="日志级别">
                  <Select placeholder="全部级别" allowClear>
                    <Option value="DEBUG">DEBUG</Option>
                    <Option value="INFO">INFO</Option>
                    <Option value="WARN">WARN</Option>
                    <Option value="ERROR">ERROR</Option>
                    <Option value="FATAL">FATAL</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="service" label="服务">
                  <Select placeholder="全部服务" allowClear>
                    <Option value="order-service">订单服务</Option>
                    <Option value="user-service">用户服务</Option>
                    <Option value="payment-service">支付服务</Option>
                    <Option value="notification-service">通知服务</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="userId" label="用户ID">
                  <Input placeholder="筛选特定用户" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="traceId" label="追踪ID">
                  <Input placeholder="筛选特定追踪" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="anomalies" label="异常类型">
                  <Select
                    mode="multiple"
                    placeholder="筛选特定异常"
                    allowClear
                    style={{ width: '100%' }}
                  >
                    {ANOMALY_TYPES.map(type => (
                      <Option key={type.value} value={type.value}>
                        {type.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Divider />

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  预览数据
                </Button>
                <Button onClick={() => form.resetFields()}>
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}

        {step === 1 && preview && (
          <div>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic 
                    title="总日志数" 
                    value={preview.summary.totalLogs}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic 
                    title="错误数" 
                    value={preview.summary.errorCount}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic 
                    title="警告数" 
                    value={preview.summary.warningCount}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic 
                    title="异常数" 
                    value={preview.summary.anomalyCount}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Card>
              </Col>
            </Row>

            {preview.anomalies && preview.anomalies.length > 0 && (
              <Card title="异常分布" size="small" style={{ marginBottom: 24 }}>
                {preview.anomalies.map((anomaly, idx) => (
                  <Alert
                    key={idx}
                    message={
                      <Space>
                        <Tag color="orange">{anomaly.count} 次</Tag>
                        <strong>{anomaly.description}</strong>
                      </Space>
                    }
                    type="warning"
                    showIcon
                    style={{ marginBottom: 8 }}
                  />
                ))}
              </Card>
            )}

            <Divider />

            <div style={{ textAlign: 'center' }}>
              <h3 style={{ marginBottom: 16 }}>选择导出格式</h3>
              <Radio.Group 
                value={selectedFormat} 
                onChange={(e) => setSelectedFormat(e.target.value)}
                style={{ marginBottom: 24 }}
              >
                <Space size={16}>
                  <Radio.Button value="json">
                    <Space>{formatIcons.json} JSON</Space>
                  </Radio.Button>
                  <Radio.Button value="excel">
                    <Space>{formatIcons.excel} Excel</Space>
                  </Radio.Button>
                  <Radio.Button value="markdown">
                    <Space>{formatIcons.markdown} Markdown</Space>
                  </Radio.Button>
                  <Radio.Button value="pdf">
                    <Space>{formatIcons.pdf} PDF</Space>
                  </Radio.Button>
                </Space>
              </Radio.Group>
            </div>

            <Form.Item style={{ textAlign: 'center' }}>
              <Space>
                <Button onClick={() => setStep(0)}>
                  返回修改
                </Button>
                <Button 
                  type="primary" 
                  icon={<DownloadOutlined />}
                  onClick={handleGenerate}
                  loading={generateMutation.isLoading}
                >
                  生成并下载报告
                </Button>
              </Space>
            </Form.Item>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ReportGenerator;
