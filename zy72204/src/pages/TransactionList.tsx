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
} from 'antd';
import {
  UploadOutlined,
  MailOutlined,
  EditOutlined,
  HistoryOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import { useCalculationStore } from '../store/calculationStore';
import { STATUS_LABELS, WORKFLOW_STEP_LABELS } from '../constants/businessRules';
import { formatCurrency, getUserFriendlyError } from '../services/businessLogic';
import type { CounterTransaction } from '../types';

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
  const [selectedTransaction, setSelectedTransaction] = useState<CounterTransaction | null>(null);
  const [emailForm] = Form.useForm();
  const [remarkForm] = Form.useForm();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload: UploadProps['beforeUpload'] = async (file) => {
    try {
      const text = await file.text();
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      
      const importResult = await importTransactions(result.data, file.name);
      
      if (importResult.errors.length > 0) {
        importResult.errors.forEach(err => message.error(getUserFriendlyError(err)));
      }
      
      message.success(
        `导入完成：成功 ${importResult.success} 条，跳过 ${importResult.skipped} 条`
      );
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
      const text = await file.text();
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      const importResult = await importTransactions(result.data, file.name);
      
      if (importResult.errors.length > 0) {
        importResult.errors.forEach(err => message.error(getUserFriendlyError(err)));
      }
      
      message.success(
        `导入完成：成功 ${importResult.success} 条，跳过 ${importResult.skipped} 条`
      );
    } else {
      message.error('请上传CSV或Excel文件');
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

  const columns = [
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
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
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
      width: 200,
    },
    {
      title: '试算状态',
      key: 'status',
      width: 120,
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
      width: 150,
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
      title: '导入时间',
      dataIndex: 'importedAt',
      key: 'importedAt',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
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
          current={1}
          items={[
            { title: '导入柜台流水', description: '阿南操作' },
            { title: '补充邮件核对', description: '阿南操作', status: 'process' },
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
            支持格式：CSV、Excel。必填字段：柜台流水尾号、业务号、交易日期、金额
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const text = await file.text();
                const result = Papa.parse(text, { header: true, skipEmptyLines: true });
                await importTransactions(result.data, file.name);
                message.success('导入完成');
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
          <Form.Item
            name="remark"
            label="备注"
          >
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
    </div>
  );
};

export default TransactionList;
