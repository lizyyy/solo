import React, { useMemo, useState } from 'react';
import {
  Card,
  Tag,
  Space,
  Button,
  Modal,
  Typography,
  DatePicker,
  Form,
  Input,
  message,
  Descriptions,
  Progress,
  Divider,
  Table,
  Empty,
} from 'antd';
import {
  FileText,
  Plus,
  Download,
  FileSpreadsheet,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileSearch,
  Mail,
  Printer,
  User,
} from 'lucide-react';
import { useContractStore, useValidationStore } from '@/store';
import { ReportService } from '@/services/reportService';
import { BatchReport } from '@/types';
import {
  formatDate,
  formatDateTime,
} from '@/utils/formatters';
import dayjs, { Dayjs } from 'dayjs';
import StatusBadge from '@/components/common/StatusBadge';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ReportPage: React.FC = () => {
  const { contracts, rolloverApps, payments, history } = useContractStore();
  const { getAllErrors } = useValidationStore();

  const [reports, setReports] = useState<BatchReport[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<BatchReport | null>(null);
  const [form] = Form.useForm();

  const generatedReports = useMemo(() => {
    if (reports.length === 0) {
      const allErrors = getAllErrors();

      const mockReports: BatchReport[] = [
        ReportService.generateReport(
          [dayjs('2026-04-01').toDate(), dayjs('2026-04-30').toDate()],
          contracts,
          rolloverApps,
          payments,
          allErrors,
          history,
          '管理员'
        ),
        ReportService.generateReport(
          [dayjs('2026-03-01').toDate(), dayjs('2026-03-31').toDate()],
          contracts,
          rolloverApps,
          payments,
          allErrors,
          history,
          '张三'
        ),
      ];
      return mockReports;
    }
    return reports;
  }, [reports, contracts, rolloverApps, payments, history, getAllErrors]);

  const handleCreate = (values: Record<string, any>) => {
    const [startDate, endDate] = values.period as [Dayjs, Dayjs];
    const allErrors = getAllErrors();

    const newReport = ReportService.generateReport(
      [startDate.toDate(), endDate.toDate()],
      contracts,
      rolloverApps,
      payments,
      allErrors,
      history,
      '管理员'
    );

    setReports([newReport, ...reports]);
    message.success('批次报告生成成功');
    setCreateModalVisible(false);
    form.resetFields();
  };

  const handlePreview = (report: BatchReport) => {
    setSelectedReport(report);
    setPreviewModalVisible(true);
  };

  const handleDownload = (report: BatchReport) => {
    ReportService.exportToExcel(report);
    message.success(`报告 ${report.fileName} 已开始下载`);
  };

  const getStatusColor = (report: BatchReport) => {
    if (report.errorCount > 0) return 'error';
    if (report.warningCount > 0) return 'warning';
    return 'success';
  };

  const renderReportCard = (report: BatchReport) => {
    const statusColor = getStatusColor(report);

    return (
      <Card
        key={report.id}
        className="mb-4 hover:shadow-lg transition-shadow"
        bodyStyle={{ padding: '20px' }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  statusColor === 'error'
                    ? 'bg-red-100'
                    : statusColor === 'warning'
                    ? 'bg-amber-100'
                    : 'bg-green-100'
                }`}
              >
                <FileSpreadsheet
                  size={20}
                  className={
                    statusColor === 'error'
                      ? 'text-error'
                      : statusColor === 'warning'
                      ? 'text-warning'
                      : 'text-success'
                  }
                />
              </div>
              <div>
                <div className="font-semibold text-lg">{report.batchNo}</div>
                <div className="text-sm text-gray-500 font-mono">
                  {report.fileName}
                </div>
              </div>
              <StatusBadge status={statusColor} />
              <Tag color="purple" className="m-0">
                批次
              </Tag>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
              <div>
                <Text type="secondary" className="text-xs">
                  统计周期
                </Text>
                <div className="text-sm font-medium">
                  {formatDate(report.period[0])} ~ {formatDate(report.period[1])}
                </div>
              </div>
              <div>
                <Text type="secondary" className="text-xs">
                  合约数
                </Text>
                <div className="text-lg font-bold text-primary-700">
                  {report.contractCount}
                </div>
              </div>
              <div>
                <Text type="secondary" className="text-xs">
                  展期数
                </Text>
                <div className="text-lg font-bold text-blue-600">
                  {report.rolloverCount}
                </div>
              </div>
              <div>
                <Text type="secondary" className="text-xs">
                  错误数
                </Text>
                <div
                  className={`text-lg font-bold ${
                    report.errorCount > 0 ? 'text-error' : 'text-success'
                  }`}
                >
                  {report.errorCount}
                </div>
              </div>
              <div>
                <Text type="secondary" className="text-xs">
                  警告数
                </Text>
                <div
                  className={`text-lg font-bold ${
                    report.warningCount > 0 ? 'text-warning' : 'text-success'
                  }`}
                >
                  {report.warningCount}
                </div>
              </div>
              <div>
                <Text type="secondary" className="text-xs">
                  通过率
                </Text>
                <div className="text-lg font-bold text-success">
                  {report.passRate.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">整体校验通过率</span>
                <span className="font-medium">
                  {report.passRate.toFixed(1)}%
                </span>
              </div>
              <Progress
                percent={report.passRate}
                size="small"
                strokeColor={
                  report.passRate >= 90
                    ? '#059669'
                    : report.passRate >= 70
                    ? '#D97706'
                    : '#DC2626'
                }
                showInfo={false}
              />
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                生成时间：{formatDateTime(report.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <User size={12} />
                生成人：{report.createdBy}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 ml-4">
            <Button
              type="primary"
              size="small"
              icon={<Eye size={14} />}
              onClick={() => handlePreview(report)}
            >
              预览
            </Button>
            <Button
              size="small"
              icon={<Download size={14} />}
              onClick={() => handleDownload(report)}
            >
              下载
            </Button>
            <Button
              size="small"
              icon={<Printer size={14} />}
              onClick={() => message.info('打印功能开发中')}
            >
              打印
            </Button>
            <Button
              size="small"
              icon={<Mail size={14} />}
              onClick={() => message.info('邮件发送功能开发中')}
            >
              发送
            </Button>
          </div>
        </div>

        <div
          className="mt-4 pt-4 border-t border-dashed border-gray-200 text-center text-gray-300 font-mono text-lg opacity-30 select-none pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(30, 64, 175, 0.03) 10px, rgba(30, 64, 175, 0.03) 20px)`,
          }}
        >
          {report.batchNo} • {report.batchNo} • {report.batchNo} • {report.batchNo}
        </div>
      </Card>
    );
  };

  const errorColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const labels: Record<string, string> = {
          link: '合约链路',
          points: '点数计算',
          match: '收付匹配',
        };
        return <Tag>{labels[type] || type}</Tag>;
      },
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => <StatusBadge status={severity} />,
    },
    {
      title: '合约/凭证',
      key: 'ref',
      width: 180,
      render: (_: any, record: any) => (
        <span className="font-mono text-sm">
          {record.contractNo || record.voucherNo || '-'}
        </span>
      ),
    },
    {
      title: '错误描述',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      ellipsis: true,
    },
    {
      title: '影响权重',
      dataIndex: 'impactOnResult',
      key: 'impactOnResult',
      width: 100,
      align: 'right' as const,
      render: (value: number) => (
        <span className="font-mono font-medium text-primary-600">{value}%</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-primary-700" />
              <span className="font-semibold">批次报告管理</span>
            </div>
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => setCreateModalVisible(true)}
            >
              生成新报告
            </Button>
          </div>
        }
        className="shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-primary-700">
                  {generatedReports.length}
                </div>
                <div className="text-sm text-gray-600">报告总数</div>
              </div>
              <FileText size={24} className="text-primary-300" />
            </div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-success">
                  {generatedReports.filter((r) => r.errorCount === 0).length}
                </div>
                <div className="text-sm text-gray-600">无错误报告</div>
              </div>
              <CheckCircle size={24} className="text-green-300" />
            </div>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-warning">
                  {generatedReports.filter((r) => r.warningCount > 0).length}
                </div>
                <div className="text-sm text-gray-600">含警告报告</div>
              </div>
              <AlertTriangle size={24} className="text-amber-300" />
            </div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-error">
                  {generatedReports.filter((r) => r.errorCount > 0).length}
                </div>
                <div className="text-sm text-gray-600">含错误报告</div>
              </div>
              <XCircle size={24} className="text-red-300" />
            </div>
          </div>
        </div>

        {generatedReports.length > 0 ? (
          <div>{generatedReports.map(renderReportCard)}</div>
        ) : (
          <Empty
            image={<FileSearch size={64} className="text-gray-300 mx-auto" />}
            description="暂无批次报告，点击上方按钮生成第一份报告"
          />
        )}
      </Card>

      <Card
        title={
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary-600" />
            <span className="font-semibold">报告规范说明</span>
          </div>
        }
        size="small"
        className="shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded">
            <div className="font-medium text-gray-700 mb-1">文件名规范</div>
            <div className="text-gray-500 font-mono text-xs">
              外汇远期展期报告_{'{batchNo}'}_{'{YYYYMMDD}'}.xlsx
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="font-medium text-gray-700 mb-1">批次号规范</div>
            <div className="text-gray-500 font-mono text-xs">
              BATCH-{'"YYYYMM-XXX"'}
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="font-medium text-gray-700 mb-1">水印规范</div>
            <div className="text-gray-500">
              报告每页均包含批次号水印，防止篡改
            </div>
          </div>
        </div>
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-primary-600" />
            生成批次报告
          </div>
        }
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="统计周期"
            name="period"
            rules={[{ required: true, message: '请选择统计周期' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="备注说明（可选）"
            name="remark"
          >
            <Input.TextArea rows={3} placeholder="请输入报告备注说明..." />
          </Form.Item>

          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <FileText size={14} className="inline mr-1" />
            报告将包含：合约明细、校验结果、操作历史，文件名和内容将自动添加批次标识
          </div>

          <Form.Item className="mb-0">
            <Space className="w-full" style={{ justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                生成报告
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye size={18} />
              报告预览 - {selectedReport?.batchNo}
            </div>
            <Space>
              <Button
                size="small"
                icon={<Download size={14} />}
                onClick={() => selectedReport && handleDownload(selectedReport)}
              >
                下载
              </Button>
            </Space>
          </div>
        }
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width={900}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        {selectedReport && (
          <div
            className="relative"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100'%3E%3Ctext x='50%25' y='50%25' font-size='14' fill='rgba(30,64,175,0.08)' text-anchor='middle' transform='rotate(-20 100 50)'%3E${selectedReport.batchNo}%3C/text%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
            }}
          >
            <div className="bg-white/80 rounded-lg p-6 relative">
              <div className="text-center mb-6 pb-4 border-b">
                <Title level={3} className="mb-2">
                  外汇远期展期业务报告
                </Title>
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                  <Tag color="purple">{selectedReport.batchNo}</Tag>
                  <span>
                    统计周期：{formatDate(selectedReport.period[0])} ~{' '}
                    {formatDate(selectedReport.period[1])}
                  </span>
                </div>
              </div>

              <Descriptions
                title="一、报告概览"
                bordered
                column={2}
                size="small"
                className="mb-6"
              >
                <Descriptions.Item label="合约总数">
                  {selectedReport.contractCount} 份
                </Descriptions.Item>
                <Descriptions.Item label="展期合约数">
                  {selectedReport.rolloverCount} 份
                </Descriptions.Item>
                <Descriptions.Item label="校验错误数">
                  <span
                    className={
                      selectedReport.errorCount > 0 ? 'text-error font-medium' : ''
                    }
                  >
                    {selectedReport.errorCount} 项
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="校验警告数">
                  <span
                    className={
                      selectedReport.warningCount > 0
                        ? 'text-warning font-medium'
                        : ''
                    }
                  >
                    {selectedReport.warningCount} 项
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="整体通过率" span={2}>
                  <Progress
                    percent={selectedReport.passRate}
                    size="small"
                    strokeColor={
                      selectedReport.passRate >= 90
                        ? '#059669'
                        : selectedReport.passRate >= 70
                        ? '#D97706'
                        : '#DC2626'
                    }
                  />
                </Descriptions.Item>
                <Descriptions.Item label="生成时间" span={2}>
                  {formatDateTime(selectedReport.createdAt)}
                </Descriptions.Item>
                <Descriptions.Item label="生成人" span={2}>
                  {selectedReport.createdBy}
                </Descriptions.Item>
              </Descriptions>

              <Divider orientation="left">二、核心指标</Divider>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">覆盖率</div>
                  <div className="text-2xl font-bold text-success">
                    {selectedReport.content.summary.coverageRate.toFixed(1)}%
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">匹配准确率</div>
                  <div className="text-2xl font-bold text-primary-700">
                    {selectedReport.content.summary.matchAccuracy.toFixed(1)}%
                  </div>
                </div>
                <div className="p-4 bg-indigo-50 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">展期率</div>
                  <div className="text-2xl font-bold text-indigo-600">
                    {selectedReport.contractCount > 0
                      ? (
                          (selectedReport.rolloverCount /
                            selectedReport.contractCount) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </div>
                </div>
              </div>

              {selectedReport.content.validationErrors.length > 0 && (
                <>
                  <Divider orientation="left">三、校验异常明细</Divider>
                  <Table
                    columns={errorColumns}
                    dataSource={selectedReport.content.validationErrors}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 5 }}
                    scroll={{ x: 800 }}
                    className="mb-6"
                  />
                </>
              )}

              <Divider orientation="left">四、报告文件信息</Divider>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Text type="secondary">文件名：</Text>
                    <Text strong className="font-mono ml-2">
                      {selectedReport.fileName}
                    </Text>
                  </div>
                  <div>
                    <Text type="secondary">批次水印：</Text>
                    <Text strong className="text-primary-600 ml-2">
                      {selectedReport.content.watermark}
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReportPage;
