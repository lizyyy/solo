import React, { useState } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Card,
  Modal,
  Select,
  Descriptions,
  Row,
  Col,
  Statistic,
  message,
  Steps,
  Alert,
  Popconfirm,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  RollbackOutlined,
  CalculatorOutlined,
  EyeOutlined,
  FileTextOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useCalculationStore } from '../store/calculationStore';
import { STATUS_LABELS, WORKFLOW_STEP_LABELS, BUSINESS_RULES } from '../constants/businessRules';
import { formatCurrency, getUserFriendlyError } from '../services/businessLogic';
import type { MarginCalculation, DiffRecord } from '../types';

const CalculationView: React.FC = () => {
  const {
    calculations,
    transactions,
    splitInfos,
    diffRecords,
    emailSupplements,
    performCalculation,
    rollbackCalculation,
    confirmSplit,
    resolveDiff,
    generateReport,
    exportReportToCSV,
    exportReportToJSON,
  } = useCalculationStore();

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCalculation, setSelectedCalculation] = useState<MarginCalculation | null>(null);
  const [selectedScenario, setSelectedScenario] = useState('中度压力');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const handleCalculation = async (businessNumber: string) => {
    try {
      await performCalculation(businessNumber, selectedScenario);
      message.success(`${selectedScenario}试算完成`);
    } catch (error) {
      message.error(getUserFriendlyError(error));
    }
  };

  const handleRollback = async (calculationId: string) => {
    try {
      await rollbackCalculation(calculationId);
      message.success('已回滚到上一版本');
    } catch (error) {
      message.error(getUserFriendlyError(error));
    }
  };

  const handleConfirmSplit = async (businessNumber: string, confirmed: boolean) => {
    try {
      await confirmSplit(businessNumber, confirmed);
      message.success(confirmed ? '已确认拆分，状态更新为正常' : '已标记为有争议');
    } catch (error) {
      message.error(getUserFriendlyError(error));
    }
  };

  const handleResolveDiff = async (diffId: string) => {
    try {
      await resolveDiff(diffId, '以柜台流水为准');
      message.success('差异已解决');
    } catch (error) {
      message.error(getUserFriendlyError(error));
    }
  };

  const handleGenerateReport = () => {
    try {
      const report = generateReport();
      setReportData(report);
      setIsReportModalOpen(true);
      message.success('报告生成成功');
    } catch (error) {
      message.error(getUserFriendlyError(error));
    }
  };

  const handleExportCSV = () => {
    try {
      const csv = exportReportToCSV();
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `期权保证金压力试算报告_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      message.success('CSV报告导出成功');
    } catch (error) {
      message.error(getUserFriendlyError(error));
    }
  };

  const handleExportJSON = () => {
    try {
      const json = exportReportToJSON();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `期权保证金压力试算报告_${dayjs().format('YYYYMMDD_HHmmss')}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      message.success('JSON报告导出成功');
    } catch (error) {
      message.error(getUserFriendlyError(error));
    }
  };

  const getBusinessTransactions = (businessNumber: string) => {
    return transactions.filter(t => t.businessNumber === businessNumber);
  };

  const getBusinessSplitInfo = (businessNumber: string) => {
    return splitInfos.find(s => s.businessNumber === businessNumber);
  };

  const getBusinessDiffs = (businessNumber: string) => {
    return diffRecords.filter(d => d.businessNumber === businessNumber);
  };

  const getBusinessEmails = (businessNumber: string) => {
    return emailSupplements.filter(e => e.businessNumber === businessNumber);
  };

  const columns = [
    {
      title: '业务号',
      dataIndex: 'businessNumber',
      key: 'businessNumber',
      width: 140,
      fixed: 'left' as const,
    },
    {
      title: '试算场景',
      dataIndex: 'scenario',
      key: 'scenario',
      width: 120,
    },
    {
      title: '基础保证金',
      dataIndex: 'baseMargin',
      key: 'baseMargin',
      width: 140,
      render: (amount: number) => formatCurrency(amount),
    },
    {
      title: '压力保证金',
      dataIndex: 'stressMargin',
      key: 'stressMargin',
      width: 140,
      render: (amount: number) => formatCurrency(amount),
    },
    {
      title: '保证金比例',
      dataIndex: 'marginRatio',
      key: 'marginRatio',
      width: 120,
      render: (ratio: number) => `${(ratio * 100).toFixed(1)}%`,
    },
    {
      title: '是否拆分',
      key: 'hasSplit',
      width: 100,
      render: (_: any, record: MarginCalculation) => (
        record.hasSplit ? <Tag color="warning">是</Tag> : <Tag color="default">否</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const statusInfo = STATUS_LABELS[status];
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>;
      },
    },
    {
      title: '流程进度',
      dataIndex: 'workflowStep',
      key: 'workflowStep',
      width: 140,
      render: (step: string) => {
        const stepInfo = WORKFLOW_STEP_LABELS[step];
        return <Tag color="blue">{stepInfo.label}</Tag>;
      },
    },
    {
      title: '计算时间',
      dataIndex: 'calculationDate',
      key: 'calculationDate',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 300,
      fixed: 'right' as const,
      render: (_: any, record: MarginCalculation) => {
        const splitInfo = getBusinessSplitInfo(record.businessNumber);
        
        return (
          <Space size="small" wrap>
            <Select
              size="small"
              value={selectedScenario}
              onChange={setSelectedScenario}
              style={{ width: 100 }}
              options={BUSINESS_RULES.MARGIN_CALCULATION.SCENARIOS.map(s => ({
                label: s.name,
                value: s.name,
              }))}
            />
            <Button
              type="primary"
              size="small"
              icon={<CalculatorOutlined />}
              onClick={() => handleCalculation(record.businessNumber)}
            >
              试算
            </Button>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedCalculation(record);
                setIsDetailModalOpen(true);
              }}
            >
              详情
            </Button>
            {record.workflowStep === 'STEP2_EMAIL_SUPPLEMENTED' && splitInfo?.status === 'PENDING_REVIEW' && (
              <>
                <Popconfirm
                  title="确认拆分正常？"
                  description="确认后该业务号将标记为正常状态"
                  onConfirm={() => handleConfirmSplit(record.businessNumber, true)}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button size="small" type="primary" icon={<CheckOutlined />}>
                    确认拆分
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title="标记为有争议？"
                  description="标记后需要进一步核查"
                  onConfirm={() => handleConfirmSplit(record.businessNumber, false)}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button size="small" danger icon={<CloseOutlined />}>
                    有争议
                  </Button>
                </Popconfirm>
              </>
            )}
            {record.status !== 'ROLLBACKED' && (
              <Popconfirm
                title="确认回滚？"
                description="将回滚到上一个版本的试算结果"
                onConfirm={() => handleRollback(record.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button size="small" icon={<RollbackOutlined />}>
                  回滚
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  const pendingReviewCount = calculations.filter(
    c => c.isPendingReview || c.status === 'SPLIT_PENDING'
  ).length;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="section-title" style={{ margin: 0 }}>保证金试算</h2>
        <Space>
          <Button 
            type="primary" 
            icon={<FileTextOutlined />} 
            onClick={handleGenerateReport}
          >
            生成报告
          </Button>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={handleExportCSV}
          >
            导出CSV
          </Button>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={handleExportJSON}
          >
            导出JSON
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="试算总数"
              value={calculations.length}
              prefix={<CalculatorOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待复核"
              value={pendingReviewCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<CheckOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已正常"
              value={calculations.filter(c => c.status === 'NORMAL').length}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="有争议"
              value={calculations.filter(c => c.status === 'DISPUTED').length}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <div className="workflow-steps">
        <Steps
          size="small"
          current={2}
          items={[
            { title: '导入柜台流水', description: '阿南操作' },
            { title: '补充邮件核对', description: '阿南操作' },
            { title: '差异清单更新', description: '结算主管复核', status: 'process' },
          ]}
        />
      </div>

      {pendingReviewCount > 0 && (
        <Alert
          message="待结算主管复核"
          description={`当前有 ${pendingReviewCount} 条记录待复核。请检查同一业务号拆分为本金和手续费的情况，确认后标记为正常。`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={calculations}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1500 }}
      />

      <Modal
        title="试算详情"
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={null}
        width={900}
      >
        {selectedCalculation && (
          <div>
            <Descriptions title="试算基本信息" bordered size="small" column={2}>
              <Descriptions.Item label="业务号">
                {selectedCalculation.businessNumber}
              </Descriptions.Item>
              <Descriptions.Item label="试算场景">
                {selectedCalculation.scenario}
              </Descriptions.Item>
              <Descriptions.Item label="基础保证金">
                {formatCurrency(selectedCalculation.baseMargin)}
              </Descriptions.Item>
              <Descriptions.Item label="压力保证金">
                {formatCurrency(selectedCalculation.stressMargin)}
              </Descriptions.Item>
              <Descriptions.Item label="保证金比例">
                {(selectedCalculation.marginRatio * 100).toFixed(1)}%
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_LABELS[selectedCalculation.status].color}>
                  {STATUS_LABELS[selectedCalculation.status].label}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Card 
              title="关联柜台流水" 
              size="small" 
              style={{ marginTop: 16 }}
              type="inner"
            >
              <Table
                dataSource={getBusinessTransactions(selectedCalculation.businessNumber)}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: '流水尾号', dataIndex: 'tailNumber', key: 'tailNumber' },
                  { title: '类型', dataIndex: 'transactionType', key: 'type', 
                    render: (t: string) => t === 'FEE' ? '手续费' : t === 'PRINCIPAL' ? '本金' : '合计' 
                  },
                  { title: '金额', dataIndex: 'amount', key: 'amount', 
                    render: (a: number) => formatCurrency(a) 
                  },
                  { title: '备注', dataIndex: 'remark', key: 'remark' },
                ]}
              />
            </Card>

            {getBusinessSplitInfo(selectedCalculation.businessNumber) && (
              <Alert
                message="拆分信息"
                description={
                  <div>
                    本金: {formatCurrency(getBusinessSplitInfo(selectedCalculation.businessNumber)!.principalAmount)} + 
                    手续费: {formatCurrency(getBusinessSplitInfo(selectedCalculation.businessNumber)!.feeAmount)} = 
                    合计: {formatCurrency(getBusinessSplitInfo(selectedCalculation.businessNumber)!.totalAmount)}
                  </div>
                }
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}

            {getBusinessDiffs(selectedCalculation.businessNumber).length > 0 && (
              <Card 
                title="差异清单" 
                size="small" 
                style={{ marginTop: 16 }}
                type="inner"
                extra={
                  <Button size="small" onClick={() => {
                    getBusinessDiffs(selectedCalculation.businessNumber).forEach(d => {
                      if (!d.resolved) handleResolveDiff(d.id);
                    });
                  }}>
                    全部解决
                  </Button>
                }
              >
                <Table
                  dataSource={getBusinessDiffs(selectedCalculation.businessNumber)}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '字段', dataIndex: 'fieldName', key: 'fieldName' },
                    { title: '柜台值', dataIndex: 'counterValue', key: 'counterValue', 
                      render: v => <span style={{ color: '#1890ff' }}>{v}</span> 
                    },
                    { title: '邮件值', dataIndex: 'emailValue', key: 'emailValue',
                      render: v => <span style={{ color: '#fa8c16' }}>{v}</span> 
                    },
                    { title: '状态', dataIndex: 'resolved', key: 'resolved',
                      render: r => r ? <Tag color="green">已解决</Tag> : <Tag color="red">待解决</Tag>
                    },
                    {
                      title: '操作',
                      key: 'action',
                      render: (_: any, record: DiffRecord) => !record.resolved && (
                        <Button size="small" onClick={() => handleResolveDiff(record.id)}>
                          解决
                        </Button>
                      ),
                    },
                  ]}
                />
              </Card>
            )}

            {getBusinessEmails(selectedCalculation.businessNumber).length > 0 && (
              <Card 
                title="关联补充邮件" 
                size="small" 
                style={{ marginTop: 16 }}
                type="inner"
              >
                {getBusinessEmails(selectedCalculation.businessNumber).map(email => (
                  <Descriptions key={email.id} size="small" column={2}>
                    <Descriptions.Item label="主题">{email.subject}</Descriptions.Item>
                    <Descriptions.Item label="发件人">{email.sender}</Descriptions.Item>
                    <Descriptions.Item label="内容" span={2}>
                      {email.supplementContent}
                    </Descriptions.Item>
                  </Descriptions>
                ))}
              </Card>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="期权保证金压力试算报告"
        open={isReportModalOpen}
        onCancel={() => setIsReportModalOpen(false)}
        footer={[
          <Button key="csv" icon={<DownloadOutlined />} onClick={handleExportCSV}>
            导出CSV
          </Button>,
          <Button key="json" icon={<DownloadOutlined />} onClick={handleExportJSON}>
            导出JSON
          </Button>,
          <Button key="close" onClick={() => setIsReportModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={1000}
      >
        {reportData && (
          <div>
            <Descriptions title="报告概览" bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="生成时间">
                {dayjs(reportData.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="生成人">
                {reportData.generatedBy}
              </Descriptions.Item>
            </Descriptions>

            <Card title="汇总统计" size="small" style={{ marginBottom: 16 }} type="inner">
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="柜台流水数" value={reportData.summary.totalTransactions} />
                </Col>
                <Col span={6}>
                  <Statistic title="流水总金额" value={reportData.summary.totalAmount} precision={2} prefix="¥" />
                </Col>
                <Col span={6}>
                  <Statistic title="试算记录数" value={reportData.summary.totalCalculations} />
                </Col>
                <Col span={6}>
                  <Statistic title="历史版本数" value={reportData.summary.totalHistoryVersions} />
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={6}>
                  <Statistic title="基础保证金合计" value={reportData.summary.totalBaseMargin} precision={2} prefix="¥" valueStyle={{ color: '#1890ff' }} />
                </Col>
                <Col span={6}>
                  <Statistic title="压力保证金合计" value={reportData.summary.totalStressMargin} precision={2} prefix="¥" valueStyle={{ color: '#fa8c16' }} />
                </Col>
                <Col span={6}>
                  <Statistic title="已解决差异" value={reportData.summary.resolvedDiffs} valueStyle={{ color: '#52c41a' }} />
                </Col>
                <Col span={6}>
                  <Statistic title="待解决差异" value={reportData.summary.unresolvedDiffs} valueStyle={{ color: '#ff4d4f' }} />
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={6}>
                  <Statistic title="补充邮件数" value={reportData.summary.totalEmails} />
                </Col>
                <Col span={6}>
                  <Statistic title="拆分记录数" value={reportData.summary.totalSplits} />
                </Col>
                <Col span={6}>
                  <Statistic title="已确认拆分" value={reportData.summary.confirmedSplits} valueStyle={{ color: '#52c41a' }} />
                </Col>
                <Col span={6}>
                  <Statistic title="有争议拆分" value={reportData.summary.rejectedSplits} valueStyle={{ color: '#ff4d4f' }} />
                </Col>
              </Row>
            </Card>

            <Card title="状态分布" size="small" style={{ marginBottom: 16 }} type="inner">
              <Space wrap>
                {Object.entries<number>(reportData.summary.statusCounts as Record<string, number>).map(([status, count]) => {
                  const statusInfo = STATUS_LABELS[status as keyof typeof STATUS_LABELS];
                  return (
                    <Tag key={status} color={statusInfo?.color || 'default'}>
                      {statusInfo?.label || status}: {count}
                    </Tag>
                  );
                })}
              </Space>
            </Card>

            <Card title="流程步骤分布" size="small" style={{ marginBottom: 16 }} type="inner">
              <Space wrap>
                {Object.entries<number>(reportData.summary.stepCounts as Record<string, number>).map(([step, count]) => {
                  const stepInfo = WORKFLOW_STEP_LABELS[step as keyof typeof WORKFLOW_STEP_LABELS];
                  return (
                    <Tag key={step} color="blue">
                      {stepInfo?.label || step}: {count}
                    </Tag>
                  );
                })}
              </Space>
            </Card>

            <Card title="试算明细" size="small" type="inner">
              <Table
                dataSource={reportData.calculations}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 5 }}
                scroll={{ x: 1200 }}
                columns={[
                  { title: '业务号', dataIndex: 'businessNumber', key: 'businessNumber', width: 140 },
                  { title: '场景', dataIndex: 'scenario', key: 'scenario', width: 100 },
                  { title: '基础保证金', dataIndex: 'baseMargin', key: 'baseMargin', width: 140, 
                    render: (v: number) => formatCurrency(v) },
                  { title: '压力保证金', dataIndex: 'stressMargin', key: 'stressMargin', width: 140,
                    render: (v: number) => formatCurrency(v) },
                  { title: '比例', dataIndex: 'marginRatio', key: 'marginRatio', width: 100,
                    render: (v: number) => `${(v * 100).toFixed(1)}%` },
                  { title: '状态', dataIndex: 'status', key: 'status', width: 100,
                    render: (s: string) => {
                      const info = STATUS_LABELS[s];
                      return <Tag color={info?.color}>{info?.label}</Tag>;
                    }},
                  { title: '流程步骤', dataIndex: 'workflowStep', key: 'workflowStep', width: 140,
                    render: (s: string) => {
                      const info = WORKFLOW_STEP_LABELS[s];
                      return <Tag color="blue">{info?.label}</Tag>;
                    }},
                  { title: '流水数', key: 'transCount', width: 80,
                    render: (_: any, r: any) => r.transactions?.length || 0 },
                  { title: '差异数', key: 'diffCount', width: 80,
                    render: (_: any, r: any) => r.diffs?.length || 0 },
                ]}
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CalculationView;
