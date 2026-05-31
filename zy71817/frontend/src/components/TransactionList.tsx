import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Select, Upload, message, Modal } from 'antd';
import { UploadOutlined, EyeOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { transactionApi } from '../utils/api';
import { Transaction, STATUS_LABELS, ANOMALY_TYPE_LABELS, SEVERITY_COLORS } from '../types';
import TransactionDetailModal from './TransactionDetailModal';

const { Option } = Select;

interface TransactionListProps {
  period: string;
  refreshKey: number;
}

const TransactionList: React.FC<TransactionListProps> = ({ period, refreshKey }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>();
  const [anomalyFilter, setAnomalyFilter] = useState<string>();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, [period, refreshKey, statusFilter, anomalyFilter]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const response = await transactionApi.getList(period, statusFilter, anomalyFilter);
      setTransactions(response.data);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (tx: Transaction) => {
    Modal.confirm({
      title: '确认流水',
      content: '确认该流水无误后，将纳入对账说明。请确认：',
      onOk: async () => {
        await transactionApi.updateStatus(tx.id, 'confirmed', '财务结算确认无误');
        message.success('已确认');
        loadTransactions();
      }
    });
  };

  const handleVoid = async (tx: Transaction) => {
    Modal.confirm({
      title: '标记作废',
      content: '该流水将被标记为作废，不会纳入对账说明。请输入作废原因：',
      okText: '确认作废',
      okButtonProps: { danger: true },
      onOk: async () => {
        await transactionApi.updateStatus(tx.id, 'void', '核实后作废');
        message.success('已作废');
        loadTransactions();
      }
    });
  };

  const handleUpload = async (file: File) => {
    try {
      const response = await transactionApi.import(file, period);
      message.success(`成功导入 ${response.data.imported} 条记录`);
      if (response.data.errors.length > 0) {
        message.warning(`${response.data.errors.length} 条记录导入失败`);
      }
      loadTransactions();
    } catch (error) {
      message.error('导入失败');
    }
    return false;
  };

  const columns: ColumnsType<Transaction> = [
    {
      title: '流水号',
      dataIndex: 'transaction_no',
      key: 'transaction_no',
      width: 140,
      render: (text, record) => (
        <a onClick={() => { setSelectedTx(record); setDetailVisible(true); }}>
          {text}
        </a>
      )
    },
    {
      title: '交易日期',
      dataIndex: 'transaction_date',
      key: 'transaction_date',
      width: 110
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (val) => <strong style={{ color: val < 0 ? '#ff4d4f' : '#333' }}>{val.toFixed(2)}</strong>
    },
    {
      title: '手续费',
      dataIndex: 'fee',
      key: 'fee',
      width: 90,
      render: (val) => val !== 0 ? val.toFixed(2) : '-'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      key: 'channel',
      width: 80
    },
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 140,
      ellipsis: true
    },
    {
      title: '付款方',
      dataIndex: 'payer',
      key: 'payer',
      width: 100,
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colors: Record<string, string> = {
          pending: 'default',
          pending_confirm: 'orange',
          confirmed: 'green',
          void: 'red'
        };
        return <Tag color={colors[status]}>{STATUS_LABELS[status]}</Tag>;
      }
    },
    {
      title: '异常',
      key: 'anomaly',
      width: 120,
      render: (_, record) => {
        if (record.current_anomaly && !record.current_anomaly.is_resolved) {
          return (
            <Tag color={SEVERITY_COLORS[record.current_anomaly.severity]}>
              {ANOMALY_TYPE_LABELS[record.current_anomaly.anomaly_type]}
            </Tag>
          );
        }
        if (record.is_manual_correction) {
          return <Tag color="purple">人工更正</Tag>;
        }
        return '-';
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setSelectedTx(record); setDetailVisible(true); }}
          >
            详情
          </Button>
          {record.status !== 'confirmed' && record.status !== 'void' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleConfirm(record)}
              >
                确认
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => handleVoid(record)}
              >
                作废
              </Button>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Upload
          beforeUpload={handleUpload}
          showUploadList={false}
          accept=".xlsx,.xls"
        >
          <Button icon={<UploadOutlined />}>导入Excel</Button>
        </Upload>
        <span>状态筛选：</span>
        <Select
          style={{ width: 120 }}
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
        >
          <Option value="pending">待处理</Option>
          <Option value="pending_confirm">待确认</Option>
          <Option value="confirmed">已确认</Option>
          <Option value="void">已作废</Option>
        </Select>
        <span>异常筛选：</span>
        <Select
          style={{ width: 140 }}
          value={anomalyFilter}
          onChange={setAnomalyFilter}
          allowClear
        >
          <Option value="duplicate">重复入账</Option>
          <Option value="cross_period_fee">手续费跨期</Option>
          <Option value="suspense_refund">退款挂账</Option>
          <Option value="late_attachment">附件晚到</Option>
        </Select>
      </Space>

      <Table
        columns={columns}
        dataSource={transactions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1200 }}
        size="small"
      />

      <TransactionDetailModal
        visible={detailVisible}
        transactionId={selectedTx?.id}
        onClose={() => setDetailVisible(false)}
        onRefresh={loadTransactions}
      />
    </div>
  );
};

export default TransactionList;
