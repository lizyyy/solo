import { useState } from 'react';
import {
  Card,
  Form,
  Select,
  DatePicker,
  Button,
  Space,
  Switch,
  Typography,
  message,
  Progress,
  Tag,
  Row,
  Col,
  Table,
  Modal,
} from 'antd';
import { DownloadOutlined, FileExcelOutlined, FileTextOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useCreateExport, useExportJob, downloadExport } from '@/api/exports.api';
import { ExportRequest, ExportFormat, ExportJob } from '@/types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface ExportFormValues {
  format: ExportFormat;
  type: 'tickets' | 'followups' | 'events' | 'comprehensive';
  dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
  includeDetails: boolean;
  includeEvents: boolean;
}

const FORMAT_ICONS: Record<ExportFormat, React.ReactNode> = {
  excel: <FileExcelOutlined style={{ color: '#217346' }} />,
  markdown: <FileTextOutlined style={{ color: '#083FA1' }} />,
  pdf: <FilePdfOutlined style={{ color: '#F40F02' }} />,
};

const TYPE_LABELS: Record<string, string> = {
  tickets: '工单数据',
  followups: '跟进记录',
  events: '事件日志',
  comprehensive: '综合报告',
};

const STATUS_LABELS: Record<ExportJob['status'], { label: string; color: string }> = {
  pending: { label: '等待中', color: 'default' },
  active: { label: '处理中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  delayed: { label: '延迟', color: 'warning' },
};

export function ExportsPage() {
  const [form] = Form.useForm<ExportFormValues>();
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);

  const createExportMutation = useCreateExport();

  const { data: jobData } = useExportJob(currentJobId || '');

  const handleSubmit = async (values: ExportFormValues) => {
    const request: ExportRequest = {
      format: values.format,
      type: values.type,
      filters: values.dateRange
        ? {
            startDate: values.dateRange[0].toISOString(),
            endDate: values.dateRange[1].toISOString(),
          }
        : undefined,
      includeDetails: values.includeDetails,
      includeEvents: values.includeEvents,
    };

    try {
      const result = await createExportMutation.mutateAsync(request);
      setCurrentJobId(result.jobId);
      message.success('导出任务已创建，正在处理中...');
    } catch (error) {
      message.error('创建导出任务失败');
    }
  };

  const handleDownload = async () => {
    if (!currentJobId || !jobData || jobData.status !== 'completed') {
      return;
    }

    try {
      await downloadExport(
        currentJobId,
        `客服系统导出-${dayjs().format('YYYYMMDDHHmmss')}.${jobData.result?.format || 'xlsx'}`
      );
      message.success('下载已开始');
    } catch (error) {
      message.error('下载失败');
    }
  };

  const columns = [
    {
      title: '参数',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>数据导出</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="导出配置">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                format: 'excel',
                type: 'tickets',
                includeDetails: true,
                includeEvents: true,
              }}
            >
              <Form.Item name="format" label="导出格式" rules={[{ required: true }]}>
                <Select>
                  <Option value="excel">
                    <Space>
                      {FORMAT_ICONS.excel}
                      Excel (.xlsx)
                    </Space>
                  </Option>
                  <Option value="markdown">
                    <Space>
                      {FORMAT_ICONS.markdown}
                      Markdown (.md)
                    </Space>
                  </Option>
                  <Option value="pdf">
                    <Space>
                      {FORMAT_ICONS.pdf}
                      PDF (.pdf)
                    </Space>
                  </Option>
                </Select>
              </Form.Item>

              <Form.Item name="type" label="数据类型" rules={[{ required: true }]}>
                <Select>
                  <Option value="tickets">{TYPE_LABELS.tickets}</Option>
                  <Option value="followups">{TYPE_LABELS.followups}</Option>
                  <Option value="events">{TYPE_LABELS.events}</Option>
                  <Option value="comprehensive">{TYPE_LABELS.comprehensive}</Option>
                </Select>
              </Form.Item>

              <Form.Item name="dateRange" label="日期范围">
                <RangePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item
                name="includeDetails"
                label="包含详情"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="includeEvents"
                label="包含事件日志"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={createExportMutation.isPending}
                    icon={<DownloadOutlined />}
                  >
                    创建导出任务
                  </Button>
                  <Button
                    onClick={() => setIsPreviewModalVisible(true)}
                  >
                    预览示例
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="当前任务状态">
            {!currentJobId ? (
              <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
                <DownloadOutlined style={{ fontSize: 48 }} />
                <div style={{ marginTop: 16 }}>暂无导出任务</div>
                <div style={{ fontSize: 12, marginTop: 8 }}>
                  配置导出参数后点击"创建导出任务"
                </div>
              </div>
            ) : !jobData ? (
              <div style={{ textAlign: 'center', padding: 50 }}>
                加载中...
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <span>任务ID:</span>
                    <code>{currentJobId}</code>
                  </Space>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <span>状态:</span>
                    <Tag color={STATUS_LABELS[jobData.status].color}>
                      {STATUS_LABELS[jobData.status].label}
                    </Tag>
                  </Space>
                </div>

                {(jobData.status === 'pending' || jobData.status === 'active') && (
                  <div style={{ marginBottom: 16 }}>
                    <Progress
                      percent={jobData.progress || 0}
                      status="active"
                    />
                  </div>
                )}

                {jobData.status === 'failed' && jobData.failedReason && (
                  <div style={{
                    marginBottom: 16,
                    padding: 12,
                    background: '#fff1f0',
                    borderRadius: 4,
                    color: '#f5222d',
                  }}>
                    错误: {jobData.failedReason}
                  </div>
                )}

                {jobData.status === 'completed' && (
                  <Button
                    type="primary"
                    onClick={handleDownload}
                    icon={<DownloadOutlined />}
                    block
                  >
                    下载文件
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card title="支持的导出格式" style={{ marginTop: 16 }}>
            <Table
              size="small"
              pagination={false}
              columns={[
                {
                  title: '格式',
                  dataIndex: 'format',
                  key: 'format',
                  render: (text, record) => (
                    <Space>
                      {record.icon}
                      {text}
                    </Space>
                  ),
                },
                {
                  title: '适用场景',
                  dataIndex: 'useCase',
                  key: 'useCase',
                },
              ]}
              dataSource={[
                {
                  format: 'Excel (.xlsx)',
                  icon: <FileExcelOutlined style={{ color: '#217346' }} />,
                  useCase: '数据分析、报表汇总、数据备份',
                },
                {
                  format: 'Markdown (.md)',
                  icon: <FileTextOutlined style={{ color: '#083FA1' }} />,
                  useCase: '技术文档、知识库、Git 仓库',
                },
                {
                  format: 'PDF (.pdf)',
                  icon: <FilePdfOutlined style={{ color: '#F40F02' }} />,
                  useCase: '正式报告、打印、归档',
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="导出预览"
        open={isPreviewModalVisible}
        onCancel={() => setIsPreviewModalVisible(false)}
        footer={null}
        width={800}
      >
        <Card type="inner" title="客服跟进系统 - 综合报告示例">
          <div style={{ lineHeight: 1.8 }}>
            <h3 style={{ marginBottom: 16 }}>一、统计概览</h3>
            <p>• 工单总数: 156</p>
            <p>• 已完成: 128 (82.1%)</p>
            <p>• 进行中: 20 (12.8%)</p>
            <p>• 待跟进: 8 (5.1%)</p>
            <p>• 逾期跟进: 2</p>

            <h3 style={{ marginTop: 24, marginBottom: 16 }}>二、跟进记录</h3>
            <p><strong>TK-001 - 客户投诉处理</strong></p>
            <p>客户: 张三 | 状态: 已完成</p>
            <p>跟进时间: 2024-01-15 10:30</p>
            <p>跟进类型: 电话回访</p>
            <p>内容: 客户对订单延迟不满，已解释原因并承诺补发小礼品...</p>
            <p>承诺动作: 3天内补发小礼品</p>
            <p>完成情况: 已补发，礼品单号 SF123456</p>
          </div>
        </Card>
      </Modal>
    </div>
  );
}

export default ExportsPage;
