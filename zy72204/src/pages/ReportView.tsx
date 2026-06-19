import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Row, Col, Statistic, List, Tag, message, Typography } from 'antd';
import {
  FileTextOutlined,
  DownloadOutlined,
  CheckOutlined,
  CalculatorOutlined,
  AlertOutlined,
  ArrowLeftOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useCalculationStore } from '../store/calculationStore';
import { formatCurrency } from '../services/businessLogic';
import dayjs from 'dayjs';

const { Text } = Typography;

const ReportView: React.FC = () => {
  const {
    transactions,
    calculations,
    diffRecords,
    emailSupplements,
    historyVersions,
    generateReport,
    exportReportCSV,
  } = useCalculationStore();

  const [reportContent, setReportContent] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');

  useEffect(() => {
    handleGenerateReport();
  }, []);

  const handleGenerateReport = () => {
    const content = generateReport();
    setReportContent(content);
    setGeneratedAt(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    message.success('报告生成成功');
  };

  const handleExportCSV = () => {
    try {
      exportReportCSV();
      message.success('报告导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportContent);
      message.success('已复制到剪贴板');
    } catch (error) {
      message.error('复制失败');
    }
  };

  const totalTransactions = transactions.length;
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const normalCount = calculations.filter(c => c.status === 'NORMAL').length;
  const disputedCount = calculations.filter(c => c.status === 'DISPUTED').length;
  const pendingReviewCount = calculations.filter(c => c.isPendingReview || c.status === 'SPLIT_PENDING').length;
  const rollbackedCount = calculations.filter(c => c.status === 'ROLLBACKED').length;
  const totalBaseMargin = calculations.reduce((sum, c) => sum + c.baseMargin, 0);
  const totalStressMargin = calculations.reduce((sum, c) => sum + c.stressMargin, 0);
  const unresolvedDiffs = diffRecords.filter(d => !d.resolved).length;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="section-title">
          <FileTextOutlined style={{ marginRight: 8 }} />
          试算报告
        </h2>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => window.history.back()}>
            返回
          </Button>
          <Button icon={<FileTextOutlined />} onClick={handleGenerateReport}>
            刷新报告
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
            导出CSV
          </Button>
          <Button type="primary" icon={<FileTextOutlined />} onClick={handleCopyReport}>
            复制报告
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="柜台流水总数"
              value={totalTransactions}
              prefix={<CalculatorOutlined />}
              suffix="条"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="交易总金额"
              value={totalAmount}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
              formatter={(value) => <span>{formatCurrency(value as number)}</span>}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="基础保证金总额"
              value={totalBaseMargin}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              formatter={(value) => <span>{formatCurrency(value as number)}</span>}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="压力保证金总额"
              value={totalStressMargin}
              precision={2}
              valueStyle={{ color: '#faad14' }}
              formatter={(value) => <span>{formatCurrency(value as number)}</span>}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="正常"
              value={normalCount}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckOutlined />}
              suffix="条"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待复核"
              value={pendingReviewCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<AlertOutlined />}
              suffix="条"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="有争议"
              value={disputedCount}
              valueStyle={{ color: '#cf1322' }}
              prefix={<AlertOutlined />}
              suffix="条"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已回滚"
              value={rollbackedCount}
              valueStyle={{ color: '#722ed1' }}
              prefix={<RollbackOutlined />}
              suffix="条"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card title="流程进度" size="small">
            <List
              size="small"
              dataSource={[
                { label: 'STEP1 已导入', value: calculations.filter(c => c.workflowStep === 'STEP1_IMPORTED').length, color: 'blue' },
                { label: 'STEP2 已补录邮件', value: calculations.filter(c => c.workflowStep === 'STEP2_EMAIL_SUPPLEMENTED').length, color: 'cyan' },
                { label: 'STEP3 差异已更新', value: calculations.filter(c => c.workflowStep === 'STEP3_DIFF_UPDATED').length, color: 'green' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <span>{item.label}</span>
                  <Tag color={item.color}>{item.value} 条</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="补充邮件和差异" size="small">
            <List
              size="small"
              dataSource={[
                { label: '补充邮件', value: emailSupplements.length, color: 'purple' },
                { label: '差异记录', value: diffRecords.length, color: 'orange' },
                { label: '未解决差异', value: unresolvedDiffs, color: 'red' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <span>{item.label}</span>
                  <Tag color={item.color}>{item.value} 条</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="历史版本统计" size="small">
            <List
              size="small"
              dataSource={[
                { label: '历史版本总数', value: historyVersions.length, color: 'default' },
                { label: '创建操作', value: historyVersions.filter(h => h.action === 'CREATE').length, color: 'green' },
                { label: '更新操作', value: historyVersions.filter(h => h.action === 'UPDATE').length, color: 'blue' },
                { label: '回滚操作', value: historyVersions.filter(h => h.action === 'ROLLBACK').length, color: 'orange' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <span>{item.label}</span>
                  <Tag color={item.color}>{item.value} 条</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={`完整报告内容`}
        extra={<Text type="secondary">生成时间: {generatedAt}</Text>}
        style={{ marginTop: 16 }}
      >
        <pre
          style={{
            background: '#f5f5f5',
            padding: '16px',
            borderRadius: '4px',
            maxHeight: '500px',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {reportContent}
        </pre>
      </Card>

      <Card title="试算明细列表" style={{ marginTop: 16 }}>
        <List
          dataSource={calculations}
          renderItem={(calc) => {
            const statusLabel = calc.status === 'NORMAL' ? '正常' :
                             calc.status === 'DISPUTED' ? '有争议' :
                             calc.status === 'SPLIT_PENDING' ? '待拆分复核' :
                             calc.status === 'ROLLBACKED' ? '已回滚' : '待复核';
            const statusColor = calc.status === 'NORMAL' ? 'green' :
                              calc.status === 'DISPUTED' ? 'red' :
                              calc.status === 'SPLIT_PENDING' ? 'orange' :
                              calc.status === 'ROLLBACKED' ? 'purple' : 'blue';
            const stepLabel = calc.workflowStep === 'STEP1_IMPORTED' ? '已导入' :
                           calc.workflowStep === 'STEP2_EMAIL_SUPPLEMENTED' ? '已补录邮件' : '差异已更新';

            return (
              <List.Item
                actions={[
                  <Tag color="blue">{stepLabel}</Tag>,
                ]}
              >
                <List.Item.Meta
                  title={
                  <Space>
                    <span>{calc.businessNumber}</span>
                    <Tag color={statusColor}>{statusLabel}</Tag>
                    {calc.hasSplit && <Tag color="warning">拆分</Tag>}
                  </Space>
                  }
                  description={
                    <div>
                    场景: {calc.scenario} | 基础保证金: {formatCurrency(calc.baseMargin)} | 压力保证金: {formatCurrency(calc.stressMargin)} | 比例: {(calc.marginRatio * 100).toFixed(1)}%
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>
    </div>
  );
};

export default ReportView;
