import React, { useState, useRef } from 'react';
import {
  Table,
  Button,
  Upload,
  Modal,
  Form,
  Input,
  Tag,
  Space,
  message,
  Steps,
  Alert,
  Popover,
  Descriptions,
} from 'antd';
import {
  UploadOutlined,
  MailOutlined,
  EditOutlined,
  HistoryOutlined,
  WarningOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import { useCalculationStore } from '../store/calculationStore';
import { STATUS_LABELS, WORKFLOW_STEP_LABELS } from '../constants/businessRules';
import { formatCurrency, getUserFriendlyError, mapColumnHeaders, normalizeImportRow, validateImport } from '../services/businessLogic';
import type { CounterTransaction } from '../types';

interface PreviewRow {
  rowNumber: number;
  tailNumber: string;
  businessNumber: string;
  transactionDate: string;
  amount: string;
  amountType: string;
  counterparty: string;
  remark: string;
  valid: boolean;
  error?: string;
  isDuplicate: boolean;
}

const TransactionList: React.FC = () => {
  const {
    transactions,
    calculations,
    splitInfos,
    importTransactions,
    importEmailSupplement,
    updateRemark,
  } = useCalculationStore();

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isRawSourceModalOpen, setIsRawSourceModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<CounterTransaction | null>(null);
  const [emailForm] = Form.useForm();
  const [remarkForm] = Form.useForm();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingRawRows, setPendingRawRows] = useState<Record<string, string>[]>([]);
  const [pendingFileName, setPendingFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const buildPreview = (rawRows: Record<string, string>[]) => {
    const rawHeaders = Object.keys(rawRows[0] || {});
    const { mapped, unmapped } = mapColumnHeaders(rawHeaders);
    setHeaderMapping(mapped);
    setUnmappedHeaders(unmapped);

    const existingTailNumbers = new Set(transactions.map(t => t.tailNumber));
    const batchTailNumbers = new Set<string>();
    const rows: PreviewRow[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const { normalized, missingFields } = normalizeImportRow(rawRows[i], mapped, i + 2);
      const isDuplicate = existingTailNumbers.has(normalized.tailNumber) || batchTailNumbers.has(normalized.tailNumber);
      const validation = missingFields.length > 0
        ? { valid: false, error: `缺少必填字段：${missingFields.join('、')}` }
        : validateImport(normalized);

      rows.push({
        rowNumber: i + 2,
        tailNumber: normalized.tailNumber || '',
        businessNumber: normalized.businessNumber || '',
        transactionDate: normalized.transactionDate || '',
        amount: normalized.amount || '',
        amountType: normalized.amountType || '',
        counterparty: normalized.counterparty || '',
        remark: normalized.remark || '',
        valid: validation.valid && !isDuplicate,
        error: isDuplicate ? '尾号重复，将跳过' : validation.error,
        isDuplicate,
      });

      if (normalized.tailNumber && validation.valid && !isDuplicate) {
        batchTailNumbers.add(normalized.tailNumber);
      }
    }

    setPreviewRows(rows);
  };

  const handleFileParsed = (rawRows: Record<string, string>[], fileName: string) => {
    if (rawRows.length === 0) {
      message.error('文件为空或格式不正确');
      return;
    }
    setPendingRawRows(rawRows);
    setPendingFileName(fileName);
    buildPreview(rawRows);
    setIsPreviewModalOpen(true);
  };

  const handleFileUpload: UploadProps['beforeUpload'] = async (file) => {
    try {
      const text = await file.text();
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      handleFileParsed(result.data as Record<string, string>[], file.name);
    } catch (error) {
      message.error(getUserFriendlyError(error));
    }
    return false;
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
      try {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        handleFileParsed(result.data as Record<string, string>[], file.name);
      } catch (error) {
        message.error(getUserFriendlyError(error));
      }
    } else {
      message.error('请上传CSV或Excel文件');
    }
  };

  const confirmImport = async () => {
    setIsImporting(true);
    try {
      const importResult = await importTransactions(pendingRawRows, pendingFileName);
      setIsPreviewModalOpen(false);
      setPendingRawRows([]);
      setPreviewRows([]);

      if (importResult.errors.length > 0) {
        Modal.warning({
          title: '导入完成（有部分问题）',
          width: 600,
          content: (
            <div>
              <p>成功导入 <strong>{importResult.success}</strong> 条，跳过重复 <strong>{importResult.skipped}</strong> 条</p>
              <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 8 }}>
                {importResult.errors.map((err, i) => (
                  <div key={i} style={{ color: '#fa541c', fontSize: 12 }}>{err}</div>
                ))}
              </div>
            </div>
          ),
        });
      } else {
        message.success(
          `导入完成：成功 ${importResult.success} 条，跳过重复 ${importResult.skipped} 条`
        );
      }
    } catch (error) {
      message.error(getUserFriendlyError(error));
    } finally {
      setIsImporting(false);
    }
  };

  const handleEmailImport = async (values: any) => {
    try {
      await importEmailSupplement(values);
      message.success('补充邮件导入成功');
      setIsEmailModalOpen(false);
      emailForm.resetFields();
    } catch (error) {
      message.error(getUserFriendlyError(error));
    }
  };

  const handleRemarkUpdate = async (values: any) => {
    if (!selectedTransaction) return;
    try {
      await updateRemark(selectedTransaction.id, values.remark);
      message.success('备注更新成功');
      setIsRemarkModalOpen(false);
      remarkForm.resetFields();
    } catch (error) {
      message.error(getUserFriendlyError(error));
    }
  };

  const getCalculationInfo = (businessNumber: string) => {
    return calculations.find(c => c.businessNumber === businessNumber);
  };

  const getSplitInfo = (businessNumber: string) => {
    return splitInfos.find(s => s.businessNumber === businessNumber);
  };

  const validPreviewCount = previewRows.filter(r => r.valid).length;
  const duplicatePreviewCount = previewRows.filter(r => r.isDuplicate).length;
  const errorPreviewCount = previewRows.filter(r => !r.valid && !r.isDuplicate).length;

  const columns = [
    {
      title: '来源行号',
      dataIndex: 'sourceRowNumber',
      key: 'sourceRowNumber',
      width: 80,
      render: (v: number) => <Tag color="blue">L{v}</Tag>,
    },
    {
      title: '柜台流水尾号',
      dataIndex: 'tailNumber',
      key: 'tailNumber',
      width: 140,
      render: (text: string, record: CounterTransaction) => {
        const splitInfo = getSplitInfo(record.businessNumber);
        return (
          <Space>
            <span>{text}</span>
            {splitInfo && splitInfo.status === 'PENDING_REVIEW' && (
              <Popover
                content={
                  <div>
                    <p>同一业务号拆分为本金和手续费两行</p>
                    <p>本金: {formatCurrency(splitInfo.principalAmount)}</p>
                    <p>手续费: {formatCurrency(splitInfo.feeAmount)}</p>
                    <p style={{ color: '#faad14' }}>待结算主管复核</p>
                  </div>
                }
                title="拆分提醒"
              >
                <WarningOutlined style={{ color: '#faad14' }} />
              </Popover>
            )}
          </Space>
        );
      },
    },
    {
      title: '业务号',
      dataIndex: 'businessNumber',
      key: 'businessNumber',
      width: 140,
    },
    {
      title: '交易日期',
      dataIndex: 'transactionDate',
      key: 'transactionDate',
      width: 120,
      render: (date: string) => {
        if (!date) return '-';
        const d = dayjs(date);
        return d.isValid() ? d.format('YYYY-MM-DD') : date;
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount: number, record: CounterTransaction) => (
        <Space direction="vertical" size={0}>
          <span>{formatCurrency(amount)}</span>
          <Tag 
            color={record.transactionType === 'FEE' ? 'purple' : 'blue'} 
            style={{ fontSize: 10, padding: '0 4px' }}
          >
            {record.transactionType === 'FEE' ? '手续费' : 
             record.transactionType === 'PRINCIPAL' ? '本金' : '合计'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '对手方',
      dataIndex: 'counterparty',
      key: 'counterparty',
      width: 120,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      width: 180,
    },
    {
      title: '试算状态',
      key: 'status',
      width: 110,
      render: (_: any, record: CounterTransaction) => {
        const calc = getCalculationInfo(record.businessNumber);
        if (!calc) return <Tag color="default">未试算</Tag>;
        const statusInfo = STATUS_LABELS[calc.status];
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>;
      },
    },
    {
      title: '流程进度',
      key: 'workflow',
      width: 120,
      render: (_: any, record: CounterTransaction) => {
        const calc = getCalculationInfo(record.businessNumber);
        if (!calc) return null;
        const stepInfo = WORKFLOW_STEP_LABELS[calc.workflowStep];
        return (
          <Popover content={stepInfo.description} title={stepInfo.label}>
            <Tag color="blue">{stepInfo.label}</Tag>
          </Popover>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: CounterTransaction) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedTransaction(record);
              remarkForm.setFieldsValue({ remark: record.remark });
              setIsRemarkModalOpen(true);
            }}
          >
            改备注
          </Button>
          <Button
            type="link"
            size="small"
            icon={<MailOutlined />}
            onClick={() => {
              emailForm.setFieldsValue({ businessNumber: record.businessNumber });
              setIsEmailModalOpen(true);
            }}
          >
            补邮件
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedTransaction(record);
              setIsRawSourceModalOpen(true);
            }}
          >
            原始行
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => {
              message.info('请前往"历史版本"页面查看详细历史');
            }}
          >
            历史
          </Button>
        </Space>
      ),
    },
  ];

  const previewColumns = [
    { title: '行号', dataIndex: 'rowNumber', key: 'rowNumber', width: 60 },
    { title: '流水尾号', dataIndex: 'tailNumber', key: 'tailNumber', width: 140 },
    { title: '业务号', dataIndex: 'businessNumber', key: 'businessNumber', width: 130 },
    { title: '日期', dataIndex: 'transactionDate', key: 'transactionDate', width: 100 },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 120 },
    {
      title: '金额类型',
      dataIndex: 'amountType',
      key: 'amountType',
      width: 90,
      render: (v: string) => {
        const colorMap: Record<string, string> = { PRINCIPAL: 'blue', FEE: 'purple', COMBINED: 'default' };
        const labelMap: Record<string, string> = { PRINCIPAL: '本金', FEE: '手续费', COMBINED: '合计' };
        const key = v || 'COMBINED';
        return <Tag color={colorMap[key] || 'default'}>{labelMap[key] || v || '合计'}</Tag>;
      },
    },
    { title: '对手方', dataIndex: 'counterparty', key: 'counterparty', width: 100 },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true, width: 140 },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_: any, record: PreviewRow) => {
        if (record.isDuplicate) return <Tag color="default">重复跳过</Tag>;
        if (!record.valid) return <Tag color="red">{record.error}</Tag>;
        return <Tag color="green">可导入</Tag>;
      },
    },
  ];

  return (
    <div className="page-container">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 className="section-title">柜台流水管理</h2>
        <Space>
          <Upload beforeUpload={handleFileUpload} accept=".csv,.xlsx" showUploadList={false}>
            <Button type="primary" icon={<UploadOutlined />}>
              导入柜台流水
            </Button>
          </Upload>
          <Button
            type="default"
            onClick={() => {
              fetch('/sample_counter_transactions.csv')
                .then(r => r.text())
                .then(text => {
                  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
                  handleFileParsed(result.data as Record<string, string>[], 'sample_counter_transactions.csv');
                })
                .catch(() => message.error('样例文件加载失败'));
            }}
          >
            加载样例CSV
          </Button>
          <Button
            icon={<MailOutlined />}
            onClick={() => setIsEmailModalOpen(true)}
          >
            导入补充邮件
          </Button>
        </Space>
      </div>

      <div className="workflow-steps">
        <Steps
          size="small"
          current={transactions.length > 0 ? 1 : 0}
          items={[
            { title: '导入柜台流水', description: '阿南操作' },
            { title: '补充邮件核对', description: '阿南操作' },
            { title: '差异清单更新', description: '结算主管复核' },
          ]}
        />
      </div>

      {transactions.length === 0 && (
        <div
          className={`import-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
          <p style={{ fontSize: 16, marginBottom: 8 }}>
            拖拽CSV文件到此处，或点击上传
          </p>
          <p style={{ color: '#666', fontSize: 12 }}>
            支持格式：CSV。中文列名自动映射：柜台流水尾号、业务号、交易日期、金额、金额类型、对手方、备注
          </p>
          <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
            或点击右上角"加载样例CSV"快速体验
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  const text = await file.text();
                  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
                  handleFileParsed(result.data as Record<string, string>[], file.name);
                } catch (error) {
                  message.error(getUserFriendlyError(error));
                }
              }
            }}
          />
        </div>
      )}

      {transactions.some(t => {
        const split = getSplitInfo(t.businessNumber);
        return split && split.status === 'PENDING_REVIEW';
      }) && (
        <Alert
          message="待复核事项"
          description={
            <div>
              <p>发现同一业务号拆分为本金和手续费两行的记录，需要结算主管复核后才能标记为正常。</p>
              <p>请前往"保证金试算"页面进行复核操作。</p>
            </div>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={transactions}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1400 }}
      />

      <Modal
        title={`导入预览 - ${pendingFileName}`}
        open={isPreviewModalOpen}
        onCancel={() => {
          setIsPreviewModalOpen(false);
          setPendingRawRows([]);
          setPreviewRows([]);
        }}
        width={1100}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsPreviewModalOpen(false);
            setPendingRawRows([]);
            setPreviewRows([]);
          }}>
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={isImporting}
            disabled={validPreviewCount === 0}
            onClick={confirmImport}
          >
            确认导入（{validPreviewCount} 条有效）
          </Button>,
        ]}
      >
        <Alert
          message="导入预览"
          description={
            <div>
              <p>文件共 <strong>{previewRows.length}</strong> 行数据，其中：</p>
              <p>
                <Tag color="green">可导入 {validPreviewCount} 条</Tag>
                {duplicatePreviewCount > 0 && <Tag color="default">重复跳过 {duplicatePreviewCount} 条</Tag>}
                {errorPreviewCount > 0 && <Tag color="red">有错误 {errorPreviewCount} 条</Tag>}
              </p>
              {unmappedHeaders.length > 0 && (
                <p style={{ color: '#fa541c', marginTop: 4 }}>
                  未识别列名：{unmappedHeaders.join('、')}（对应列数据将被忽略）
                </p>
              )}
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
        />

        {Object.keys(headerMapping).length > 0 && (
          <Descriptions title="列名映射" size="small" bordered column={3} style={{ marginBottom: 12 }}>
            {Object.entries(headerMapping).map(([raw, internal]) => (
              <Descriptions.Item key={raw} label={raw}>
                <Tag color="blue">{internal}</Tag>
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}

        <Table
          columns={previewColumns}
          dataSource={previewRows}
          rowKey="rowNumber"
          size="small"
          pagination={{ pageSize: 8 }}
          scroll={{ x: 950 }}
          rowClassName={(record) => record.isDuplicate ? 'row-duplicate' : !record.valid ? 'row-error' : 'row-valid'}
        />
      </Modal>

      <Modal
        title="导入客户经理补充邮件"
        open={isEmailModalOpen}
        onCancel={() => setIsEmailModalOpen(false)}
        onOk={() => emailForm.submit()}
        width={600}
      >
        <Form
          form={emailForm}
          layout="vertical"
          onFinish={handleEmailImport}
        >
          <Form.Item
            name="businessNumber"
            label="业务号"
            rules={[{ required: true, message: '请输入业务号' }]}
          >
            <Input placeholder="请输入对应业务号" />
          </Form.Item>
          <Form.Item
            name="subject"
            label="邮件主题"
            rules={[{ required: true, message: '请输入邮件主题' }]}
          >
            <Input placeholder="请输入邮件主题" />
          </Form.Item>
          <Form.Item
            name="sender"
            label="发件人"
            rules={[{ required: true, message: '请输入发件人' }]}
          >
            <Input placeholder="请输入发件人邮箱或姓名" />
          </Form.Item>
          <Form.Item
            name="sentAt"
            label="发送时间"
            rules={[{ required: true, message: '请选择发送时间' }]}
          >
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item
            name="content"
            label="邮件内容"
            rules={[{ required: true, message: '请输入邮件内容' }]}
          >
            <Input.TextArea rows={6} placeholder="请粘贴邮件正文内容" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改备注"
        open={isRemarkModalOpen}
        onCancel={() => setIsRemarkModalOpen(false)}
        onOk={() => remarkForm.submit()}
      >
        <Form
          form={remarkForm}
          layout="vertical"
          onFinish={handleRemarkUpdate}
        >
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={4} placeholder="请输入备注" />
          </Form.Item>
          <Alert
            message="提示"
            description="修改备注后，历史版本中将保留修改前后的对比记录。"
            type="info"
            showIcon
          />
        </Form>
      </Modal>

      <Modal
        title={`原始行数据 - 尾号 ${selectedTransaction?.tailNumber}`}
        open={isRawSourceModalOpen}
        onCancel={() => setIsRawSourceModalOpen(false)}
        footer={null}
        width={600}
      >
        {selectedTransaction && (
          <div>
            <Descriptions size="small" bordered column={1} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="来源行号">第 {selectedTransaction.sourceRowNumber} 行</Descriptions.Item>
              <Descriptions.Item label="流水尾号">{selectedTransaction.tailNumber}</Descriptions.Item>
              <Descriptions.Item label="业务号">{selectedTransaction.businessNumber}</Descriptions.Item>
              <Descriptions.Item label="金额">{formatCurrency(selectedTransaction.amount)}</Descriptions.Item>
              <Descriptions.Item label="类型">{selectedTransaction.transactionType}</Descriptions.Item>
            </Descriptions>
            <Descriptions title="CSV原始列值" size="small" bordered column={1}>
              {Object.entries(selectedTransaction.rawSource).map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>{value || '(空)'}</Descriptions.Item>
              ))}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionList;
