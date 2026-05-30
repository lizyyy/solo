import React, { useMemo, useState } from 'react';
import { Card, Table, Tag, Space, Button, Modal, Form, Select, message, Typography, Tooltip, Badge } from 'antd';
import {
  Receipt,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Link2,
  Unlink,
  FileText,
  Search,
} from 'lucide-react';
import { useContractStore, useValidationStore } from '@/store';
import StatusBadge from '@/components/common/StatusBadge';
import ValidationPanel from '@/components/common/ValidationPanel';
import { PaymentRecord, ForwardContract } from '@/types';
import { formatAmount, formatDate } from '@/utils/formatters';
import { AMOUNT_MATCH_TOLERANCE, PAYMENT_DATE_TOLERANCE_DAYS } from '@/utils/constants';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const PaymentMatch: React.FC = () => {
  const { contracts, payments, loading } = useContractStore();
  const { matchValidation, getErrorsByType, loading: validationLoading } =
    useValidationStore();

  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [form] = Form.useForm();

  const matchErrors = getErrorsByType('match');

  const getMatchedContract = (payment: PaymentRecord): ForwardContract | undefined => {
    if (payment.contractId) {
      return contracts.find((c) => c.id === payment.contractId);
    }
    return undefined;
  };

  const getValidationResult = (paymentId: string) => {
    return matchValidation.find((r) => r.paymentId === paymentId);
  };

  const getSuggestedContracts = (payment: PaymentRecord): ForwardContract[] => {
    return contracts.filter((c) => {
      const amountMatch =
        Math.abs(payment.amount - c.notionalAmount * c.forwardRate) /
          (c.notionalAmount * c.forwardRate) <=
        AMOUNT_MATCH_TOLERANCE;
      const dateMatch =
        Math.abs(dayjs(payment.paymentDate).diff(dayjs(c.valueDate), 'day')) <=
        PAYMENT_DATE_TOLERANCE_DAYS;
      const currencyMatch = payment.currency === 'CNY';
      return amountMatch && dateMatch && currencyMatch && c.status !== 'cancelled';
    });
  };

  const handleMatch = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    const suggested = getSuggestedContracts(payment);
    form.setFieldsValue({
      contractId: suggested.length > 0 ? suggested[0].id : undefined,
    });
    setMatchModalVisible(true);
  };

  const handleMatchSubmit = async (_values: any) => {
    if (!selectedPayment) return;
    message.success('匹配成功');
    setMatchModalVisible(false);
  };

  const matrixData = useMemo(() => {
    return {
      contracts: contracts.slice(0, 6),
      payments: payments,
      matches: payments.map((p) => ({
        paymentId: p.id,
        contractIds: p.matchedContractIds,
        status: p.matchedStatus,
      })),
    };
  }, [contracts, payments]);

  const getMatchStatusColor = (paymentId: string, contractId: string) => {
    const match = matrixData.matches.find((m) => m.paymentId === paymentId);
    if (!match) return 'bg-gray-50';
    if (match.contractIds.includes(contractId)) {
      if (match.status === 'duplicate') return 'bg-red-100 border-red-300';
      if (match.status === 'matched') return 'bg-green-100 border-green-300';
    }
    return 'bg-gray-50';
  };

  const renderMatchMatrix = () => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-3 bg-gray-50 border border-gray-200 text-left text-sm font-semibold text-gray-700 min-w-[160px] sticky left-0 z-10">
              收付凭证 \ 合约
            </th>
            {matrixData.contracts.map((c) => (
              <th
                key={c.id}
                className="p-3 bg-gray-50 border border-gray-200 text-center text-xs font-medium text-gray-600 min-w-[140px]"
              >
                <div className="font-mono">{c.contractNo}</div>
                <div className="text-[10px] text-gray-400">{c.currencyPair}</div>
              </th>
            ))}
            <th className="p-3 bg-gray-50 border border-gray-200 text-center text-sm font-semibold text-gray-700 min-w-[100px]">
              状态
            </th>
          </tr>
        </thead>
        <tbody>
          {matrixData.payments.map((p, pIdx) => (
            <tr key={p.id} className={pIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
              <td className="p-3 border border-gray-200 sticky left-0 z-10 bg-inherit">
                <div className="font-mono text-sm font-medium text-primary-700">
                  {p.voucherNo}
                </div>
                <div className="text-xs text-gray-500">
                  {formatAmount(p.amount)} {p.currency}
                </div>
                <div className="text-xs text-gray-400">{formatDate(p.paymentDate)}</div>
              </td>
              {matrixData.contracts.map((c) => {
                const isMatched = p.matchedContractIds.includes(c.id);
                const colorClass = getMatchStatusColor(p.id, c.id);
                return (
                  <td
                    key={c.id}
                    className={`p-3 border border-gray-200 text-center ${colorClass} transition-colors hover:bg-blue-50`}
                  >
                    {isMatched ? (
                      <Tooltip
                        title={
                          p.matchedStatus === 'duplicate'
                            ? '重复匹配'
                            : '已匹配'
                        }
                      >
                        <Badge
                          status={p.matchedStatus === 'duplicate' ? 'error' : 'success'}
                          text={
                            <Link2
                              size={16}
                              className={
                                p.matchedStatus === 'duplicate'
                                  ? 'text-error'
                                  : 'text-success'
                              }
                            />
                          }
                        />
                      </Tooltip>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                );
              })}
              <td className="p-3 border border-gray-200 text-center">
                <StatusBadge status={p.matchedStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const tableColumns = [
    {
      title: '收付凭证号',
      dataIndex: 'voucherNo',
      key: 'voucherNo',
      width: 180,
      render: (text: string) => (
        <span className="font-mono font-medium text-primary-700">{text}</span>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right' as const,
      render: (value: number, record: PaymentRecord) => (
        <span className="font-mono">
          {formatAmount(value)} {record.currency}
        </span>
      ),
    },
    {
      title: '收付日期',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 120,
      render: (value: Date) => formatDate(value),
    },
    {
      title: '类型',
      dataIndex: 'paymentType',
      key: 'paymentType',
      width: 100,
      render: (value: string) => {
        const labels: Record<string, string> = {
          settlement: '结算款',
          margin: '保证金',
          fee: '手续费',
        };
        return labels[value] || value;
      },
    },
    {
      title: '匹配合约',
      key: 'matchedContract',
      width: 180,
      render: (_: any, record: PaymentRecord) => {
        const contract = getMatchedContract(record);
        if (contract) {
          return <span className="font-mono text-sm">{contract.contractNo}</span>;
        }
        if (record.matchedContractIds.length > 1) {
          return (
            <Tag color="error" className="m-0">
              匹配 {record.matchedContractIds.length} 个合约
            </Tag>
          );
        }
        return <Tag color="orange">未匹配</Tag>;
      },
    },
    {
      title: '匹配状态',
      dataIndex: 'matchedStatus',
      key: 'matchedStatus',
      width: 100,
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: '校验结果',
      key: 'validation',
      width: 100,
      render: (_: any, record: PaymentRecord) => {
        const result = getValidationResult(record.id);
        if (!result) return <Tag>待校验</Tag>;
        if (result.isDuplicate) {
          return (
            <Space>
              <XCircle size={14} className="text-error" />
              <span className="text-error text-sm">重复</span>
            </Space>
          );
        }
        if (result.errors.some((e) => e.severity === 'warning')) {
          return (
            <Space>
              <AlertTriangle size={14} className="text-warning" />
              <span className="text-warning text-sm">警告</span>
            </Space>
          );
        }
        if (record.matchedStatus === 'matched') {
          return (
            <Space>
              <CheckCircle size={14} className="text-success" />
              <span className="text-success text-sm">正常</span>
            </Space>
          );
        }
        return (
          <Space>
            <AlertTriangle size={14} className="text-info" />
            <span className="text-info text-sm">待匹配</span>
          </Space>
        );
      },
    },
    {
      title: '凭证材料',
      dataIndex: 'materialRef',
      key: 'materialRef',
      width: 180,
      ellipsis: true,
      render: (value: string) => (
        <Tooltip title={value}>
          <Space>
            <FileText size={14} className="text-gray-400" />
            <span className="text-sm text-gray-600">{value}</span>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: PaymentRecord) => (
        <Space size="small">
          {record.matchedStatus === 'unmatched' ? (
            <Button
              type="link"
              size="small"
              icon={<Link2 size={14} />}
              onClick={() => handleMatch(record)}
            >
              匹配
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<Unlink size={14} />}
              danger
            >
              解除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const stats = {
    total: payments.length,
    matched: payments.filter((p) => p.matchedStatus === 'matched').length,
    unmatched: payments.filter((p) => p.matchedStatus === 'unmatched').length,
    duplicate: payments.filter((p) => p.matchedStatus === 'duplicate').length,
    matchRate:
      payments.length > 0
        ? ((payments.filter((p) => p.matchedStatus === 'matched').length /
            payments.length) *
            100).toFixed(1)
        : '100',
  };

  return (
    <div className="space-y-6">
      <Card
        title={
          <div className="flex items-center gap-3">
            <Receipt size={20} className="text-primary-700" />
            <span className="font-semibold">收付匹配概览</span>
            <Tag color="blue">对结果影响权重 10%</Tag>
          </div>
        }
        className="shadow-sm"
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-primary-700">{stats.total}</div>
            <div className="text-sm text-gray-600">收付记录</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-success">{stats.matched}</div>
            <div className="text-sm text-gray-600">已匹配</div>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-warning">{stats.unmatched}</div>
            <div className="text-sm text-gray-600">未匹配</div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-error">{stats.duplicate}</div>
            <div className="text-sm text-gray-600">重复匹配</div>
          </div>
          <div className="p-4 bg-indigo-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-indigo-600">{stats.matchRate}%</div>
            <div className="text-sm text-gray-600">匹配率</div>
          </div>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <Title level={5} className="mb-3">
            <Search size={16} className="inline mr-2" />
            匹配矩阵
          </Title>
          <div className="text-sm text-gray-500 mb-3">
            行：收付记录，列：远期合约，交叉点表示匹配关系
          </div>
          {renderMatchMatrix()}
          <div className="flex flex-wrap gap-6 mt-4 text-sm">
            <Space>
              <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
              <span>正常匹配</span>
            </Space>
            <Space>
              <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
              <span>重复匹配</span>
            </Space>
            <Space>
              <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" />
              <span>未匹配</span>
            </Space>
          </div>
        </div>

        <Table
          columns={tableColumns}
          dataSource={payments}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Card
        title={
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            <span className="font-semibold">匹配规则说明</span>
          </div>
        }
        size="small"
        className="shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded">
            <div className="font-medium text-gray-700 mb-1">唯一性校验</div>
            <div className="text-gray-500">
              同一收付凭证只能匹配一个合约
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="font-medium text-gray-700 mb-1">金额一致性</div>
            <div className="text-gray-500">
              收付金额与合约结算金额偏差 ±
              {AMOUNT_MATCH_TOLERANCE * 100}% 以内
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="font-medium text-gray-700 mb-1">时间合理性</div>
            <div className="text-gray-500">
              收付日期与合约到期日相差 ±
              {PAYMENT_DATE_TOLERANCE_DAYS} 天以内
            </div>
          </div>
        </div>
      </Card>

      <ValidationPanel errors={matchErrors} loading={validationLoading} />

      <Modal
        title={
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-primary-600" />
            匹配收付凭证到合约
          </div>
        }
        open={matchModalVisible}
        onCancel={() => setMatchModalVisible(false)}
        footer={null}
        width={500}
      >
        {selectedPayment && (
          <Form form={form} layout="vertical" onFinish={handleMatchSubmit}>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between mb-2">
                <Text type="secondary">收付凭证：</Text>
                <Text strong className="font-mono">
                  {selectedPayment.voucherNo}
                </Text>
              </div>
              <div className="flex justify-between mb-2">
                <Text type="secondary">金额：</Text>
                <Text strong className="font-mono">
                  {formatAmount(selectedPayment.amount)} {selectedPayment.currency}
                </Text>
              </div>
              <div className="flex justify-between">
                <Text type="secondary">日期：</Text>
                <Text>{formatDate(selectedPayment.paymentDate)}</Text>
              </div>
            </div>

            <Form.Item
              label="匹配合约"
              name="contractId"
              rules={[{ required: true, message: '请选择要匹配的合约' }]}
            >
              <Select
                placeholder="请选择要匹配的远期合约"
                showSearch
                optionFilterProp="label"
                options={contracts.map((c) => ({
                  label: `${c.contractNo} - ${c.currencyPair} - ${formatAmount(
                    c.notionalAmount * c.forwardRate
                  )} CNY`,
                  value: c.id,
                }))}
              />
            </Form.Item>

            <div className="mb-4">
              <Text type="secondary" className="text-xs">
                💡 系统自动推荐的匹配合约：
              </Text>
              <div className="mt-2">
                {getSuggestedContracts(selectedPayment).length > 0 ? (
                  getSuggestedContracts(selectedPayment).map((c) => (
                    <Tag key={c.id} color="green" className="m-1">
                      {c.contractNo}
                    </Tag>
                  ))
                ) : (
                  <Text type="secondary" className="text-xs">
                    暂无推荐，请手动选择
                  </Text>
                )}
              </div>
            </div>

            <Form.Item className="mb-0">
              <Space className="w-full" style={{ justifyContent: 'flex-end' }}>
                <Button onClick={() => setMatchModalVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit">
                  确认匹配
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default PaymentMatch;
