import React, { useMemo } from 'react';
import { Card, Table, Button, Space, Tooltip, Modal, Form, Input, InputNumber, message } from 'antd';
import {
  FileText,
  GitBranch,
  AlertTriangle,
  Receipt,
  CheckCircle,
  Edit3,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { useContractStore, useValidationStore, useFilterStore } from '@/store';
import StatCard from '@/components/common/StatCard';
import FilterBar from '@/components/common/FilterBar';
import StatusBadge from '@/components/common/StatusBadge';
import ValidationPanel from '@/components/common/ValidationPanel';
import TrendChart from '@/components/charts/TrendChart';
import ErrorDistributionChart from '@/components/charts/ErrorDistributionChart';
import CurrencyChart from '@/components/charts/CurrencyChart';
import {
  formatAmount,
  formatRate,
  formatDate,
} from '@/utils/formatters';
import { ForwardContract, ValidationError } from '@/types';

const Dashboard: React.FC = () => {
  const { contracts, payments, loading, updateContract } = useContractStore();
  const { getAllErrors, loading: validationLoading, runValidation } =
    useValidationStore();
  const { getFilteredContracts, getFilteredErrors } = useFilterStore();

  const [editModalVisible, setEditModalVisible] = React.useState(false);
  const [editingContract, setEditingContract] = React.useState<ForwardContract | null>(null);
  const [form] = Form.useForm();

  const filteredContracts = useMemo(
    () => getFilteredContracts(contracts),
    [contracts, getFilteredContracts]
  );

  const allErrors = useMemo(() => getAllErrors(), [getAllErrors]);
  const filteredErrors = useMemo(
    () => getFilteredErrors(allErrors),
    [allErrors, getFilteredErrors]
  );

  const stats = useMemo(() => {
    const total = filteredContracts.length;
    const rolled = filteredContracts.filter((c) => c.status === 'rolled').length;
    const errors = filteredErrors.filter((e) => e.severity === 'error').length;
    const warnings = filteredErrors.filter((e) => e.severity === 'warning').length;
    const unmatched = payments.filter((p) => p.matchedStatus === 'unmatched').length;
    const duplicate = payments.filter((p) => p.matchedStatus === 'duplicate').length;
    const passRate =
      total > 0 ? Math.max(0, ((total - errors) / total) * 100).toFixed(1) : '100';

    return { total, rolled, errors, warnings, unmatched, duplicate, passRate };
  }, [filteredContracts, filteredErrors, payments]);

  const handleLocateError = (error: ValidationError) => {
    message.info(`定位到 ${error.contractNo || error.voucherNo}`);
  };

  const handleEdit = (record: ForwardContract) => {
    setEditingContract(record);
    form.setFieldsValue({
      notionalAmount: record.notionalAmount,
      forwardRate: record.forwardRate,
      counterparty: record.counterparty,
    });
    setEditModalVisible(true);
  };

  const handleEditSubmit = async (values: Record<string, any>) => {
    if (!editingContract) return;

    try {
      await updateContract(
        editingContract.id,
        values,
        '人工修正数据',
        '管理员'
      );
      message.success('合约信息更新成功，已记录操作历史');
      setEditModalVisible(false);
      runValidation(contracts, useContractStore.getState().rolloverApps, payments);
    } catch (error) {
      message.error('更新失败：' + (error as Error).message);
    }
  };

  const handleRefresh = () => {
    runValidation(contracts, useContractStore.getState().rolloverApps, payments);
    message.success('校验已重新执行');
  };

  const tableColumns = [
    {
      title: '合约编号',
      dataIndex: 'contractNo',
      key: 'contractNo',
      width: 200,
      render: (text: string, record: ForwardContract) => (
        <Space>
          <span className="font-mono font-medium text-primary-700">{text}</span>
          {record.isManuallyModified && (
            <Tooltip title="已人工修正">
              <Edit3 size={12} className="text-warning" />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '币种对',
      dataIndex: 'currencyPair',
      key: 'currencyPair',
      width: 100,
    },
    {
      title: '名义金额',
      dataIndex: 'notionalAmount',
      key: 'notionalAmount',
      width: 150,
      align: 'right' as const,
      render: (value: number, record: ForwardContract) => {
        const [base] = record.currencyPair.split('/');
        return (
          <span className="font-mono">
            {formatAmount(value)} {base}
          </span>
        );
      },
    },
    {
      title: '远期汇率',
      dataIndex: 'forwardRate',
      key: 'forwardRate',
      width: 120,
      align: 'right' as const,
      render: (value: number) => (
        <span className="font-mono">{formatRate(value)}</span>
      ),
    },
    {
      title: '交易对手',
      dataIndex: 'counterparty',
      key: 'counterparty',
      width: 120,
    },
    {
      title: '交易日',
      dataIndex: 'tradeDate',
      key: 'tradeDate',
      width: 120,
      render: (value: Date) => formatDate(value),
    },
    {
      title: '到期日',
      dataIndex: 'valueDate',
      key: 'valueDate',
      width: 120,
      render: (value: Date) => formatDate(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: '展期链路',
      key: 'chain',
      width: 100,
      render: (_: any, record: ForwardContract) => (
        <Space>
          {record.rolloverFrom && (
            <Tooltip title="来源合约">
              <GitBranch size={14} className="text-gray-400" />
            </Tooltip>
          )}
          {record.rolloverTo && (
            <Tooltip title="已展期">
              <GitBranch size={14} className="text-success" />
            </Tooltip>
          )}
          {!record.rolloverFrom && !record.rolloverTo && (
            <span className="text-gray-300">-</span>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      fixed: 'right' as const,
      render: (_: any, record: ForwardContract) => (
        <Space size="small">
          <Button type="link" size="small" icon={<Eye size={14} />}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<Edit3 size={14} />}
            onClick={() => handleEdit(record)}
          >
            修正
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <FilterBar />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard
          title="合约总数"
          value={stats.total}
          unit="份"
          trend={5.2}
          trendLabel="较上月"
          icon={<FileText size={20} />}
          color="primary"
        />
        <StatCard
          title="展期合约"
          value={stats.rolled}
          unit="份"
          trend={12.5}
          trendLabel="较上月"
          icon={<GitBranch size={20} />}
          color="success"
        />
        <StatCard
          title="校验错误"
          value={stats.errors}
          unit="项"
          trend={-15.3}
          trendLabel="较上月"
          icon={<AlertTriangle size={20} />}
          color="error"
        />
        <StatCard
          title="校验警告"
          value={stats.warnings}
          unit="项"
          icon={<AlertTriangle size={20} />}
          color="warning"
        />
        <StatCard
          title="未匹配收付"
          value={stats.unmatched}
          unit="笔"
          icon={<Receipt size={20} />}
          color="info"
        />
        <StatCard
          title="校验通过率"
          value={stats.passRate}
          unit="%"
          icon={<CheckCircle size={20} />}
          color="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          title={
            <div className="flex items-center justify-between">
              <span className="font-semibold">业务趋势</span>
              <Button
                type="text"
                size="small"
                icon={<RefreshCw size={14} />}
                onClick={handleRefresh}
              >
                刷新
              </Button>
            </div>
          }
          className="lg:col-span-2 shadow-sm"
        >
          <TrendChart height={280} />
        </Card>

        <Card title={<span className="font-semibold">币种分布</span>} className="shadow-sm">
          <CurrencyChart height={280} />
        </Card>
      </div>

      <Card
        title={<span className="font-semibold">异常类型分布</span>}
        className="shadow-sm"
      >
        <ErrorDistributionChart height={300} />
      </Card>

      <Card
        title={
          <div className="flex items-center justify-between">
            <span className="font-semibold">合约明细</span>
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<RefreshCw size={14} />}
                onClick={handleRefresh}
                loading={validationLoading}
              >
                重新校验
              </Button>
              <Button type="text" size="small">
                导出
              </Button>
            </Space>
          </div>
        }
        className="shadow-sm"
      >
        <Table
          columns={tableColumns}
          dataSource={filteredContracts}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <ValidationPanel
        errors={filteredErrors}
        loading={validationLoading}
        onLocate={handleLocateError}
      />

      <Modal
        title={
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-warning" />
            人工修正合约信息
          </div>
        }
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={500}
      >
        {editingContract && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleEditSubmit}
            initialValues={{
              notionalAmount: editingContract.notionalAmount,
              forwardRate: editingContract.forwardRate,
              counterparty: editingContract.counterparty,
            }}
          >
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle size={14} className="inline mr-1" />
              人工修正将记录操作历史，请确保修改理由充分
            </div>

            <Form.Item
              label="合约编号"
              name="contractNo"
            >
              <Input value={editingContract.contractNo} disabled />
            </Form.Item>

            <Form.Item
              label="名义金额"
              name="notionalAmount"
              rules={[{ required: true, message: '请输入名义金额' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>

            <Form.Item
              label="远期汇率"
              name="forwardRate"
              rules={[{ required: true, message: '请输入远期汇率' }]}
            >
              <InputNumber style={{ width: '100%' }} step={0.0001} precision={4} />
            </Form.Item>

            <Form.Item
              label="交易对手"
              name="counterparty"
              rules={[{ required: true, message: '请选择交易对手' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              label="修改原因"
              name="reason"
              rules={[{ required: true, message: '请填写修改原因' }]}
            >
              <Input.TextArea rows={3} placeholder="请详细说明修改原因..." />
            </Form.Item>

            <Form.Item className="mb-0">
              <Space className="w-full" style={{ justifyContent: 'flex-end' }}>
                <Button onClick={() => setEditModalVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit">
                  确认修改
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;
