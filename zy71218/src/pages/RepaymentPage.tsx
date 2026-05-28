import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Sparkles,
  Check,
  X,
  Wallet,
} from 'lucide-react';
import Card from '@/components/Card';
import Table from '@/components/Table';
import Loading from '@/components/Loading';
import ErrorState from '@/components/ErrorState';
import Modal from '@/components/Modal';
import SearchBar from '@/components/SearchBar';
import { WriteOffBadge } from '@/components/StatusBadge';
import { repaymentService } from '@/services/repaymentService';
import { cn } from '@/lib/utils';
import type { Repayment, WriteOffStatus, RepaymentPlan } from '../../shared/types';

interface MatchResult {
  id: string;
  type: string;
  description: string;
  amount: number;
  matchScore: number;
  suggested: boolean;
}

const MOCK_PLANS: RepaymentPlan[] = [
  {
    id: 'p1',
    businessNo: 'BL2024001',
    instalmentNo: 1,
    principal: 500000,
    interest: 25000,
    plannedDate: '2024-03-15',
    status: 'pending',
    version: 1,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'p2',
    businessNo: 'BL2024001',
    instalmentNo: 2,
    principal: 500000,
    interest: 20000,
    plannedDate: '2024-06-15',
    status: 'pending',
    version: 1,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

export default function RepaymentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRepayments, setPendingRepayments] = useState<Repayment[]>([]);
  const [completedRepayments, setCompletedRepayments] = useState<Repayment[]>([]);
  const [pendingPagination, setPendingPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [completedPagination, setCompletedPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [selectedRepayment, setSelectedRepayment] = useState<Repayment | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    businessNo: '',
    repaymentDate: new Date().toISOString().split('T')[0],
    totalAmount: '',
    principalPaid: '',
    interestPaid: '',
    penaltyPaid: '',
    payer: '',
    remark: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pendingRes, completedRes] = await Promise.all([
        repaymentService.getRepaymentList(pendingPagination.current, pendingPagination.pageSize, {
          writeOffStatus: 'pending',
          businessNo: searchKeyword || undefined,
        }),
        repaymentService.getRepaymentList(completedPagination.current, completedPagination.pageSize, {
          writeOffStatus: 'full',
          businessNo: searchKeyword || undefined,
        }),
      ]);

      if (pendingRes.success && pendingRes.data) {
        setPendingRepayments(pendingRes.data.list);
        setPendingPagination((prev) => ({ ...prev, total: pendingRes.data!.total }));
      }

      if (completedRes.success && completedRes.data) {
        setCompletedRepayments(completedRes.data.list);
        setCompletedPagination((prev) => ({ ...prev, total: completedRes.data!.total }));
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pendingPagination.current, pendingPagination.pageSize, completedPagination.current, completedPagination.pageSize, searchKeyword]);

  const handleSearch = () => {
    setPendingPagination((prev) => ({ ...prev, current: 1 }));
    setCompletedPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleRegisterSubmit = async () => {
    if (!formData.businessNo || !formData.repaymentDate || !formData.totalAmount) {
      setError('请填写必要信息');
      return;
    }

    try {
      setSubmitting(true);
      const res = await repaymentService.createRepayment({
        businessNo: formData.businessNo,
        repaymentDate: formData.repaymentDate,
        totalAmount: parseFloat(formData.totalAmount),
        principalPaid: formData.principalPaid ? parseFloat(formData.principalPaid) : 0,
        interestPaid: formData.interestPaid ? parseFloat(formData.interestPaid) : 0,
        penaltyPaid: formData.penaltyPaid ? parseFloat(formData.penaltyPaid) : 0,
        payer: formData.payer,
        remark: formData.remark,
      });

      if (res.success) {
        setShowRegisterModal(false);
        setFormData({
          businessNo: '',
          repaymentDate: new Date().toISOString().split('T')[0],
          totalAmount: '',
          principalPaid: '',
          interestPaid: '',
          penaltyPaid: '',
          payer: '',
          remark: '',
        });
        loadData();
      } else {
        setError(res.error || '登记失败');
      }
    } catch (err: any) {
      setError(err.message || '登记失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWriteOff = (repayment: Repayment) => {
    setSelectedRepayment(repayment);
    
    const mockMatches: MatchResult[] = MOCK_PLANS.map((plan) => ({
      id: plan.id,
      type: '回款计划',
      description: `第 ${plan.instalmentNo} 期 - 本金 ¥${plan.principal.toLocaleString()}，利息 ¥${plan.interest.toLocaleString()}`,
      amount: plan.principal + plan.interest,
      matchScore: Math.floor(Math.random() * 20) + 80,
      suggested: true,
    }));
    
    setMatchResults(mockMatches);
    setShowWriteOffModal(true);
  };

  const handleConfirmWriteOff = async () => {
    if (!selectedRepayment) return;

    try {
      setSubmitting(true);
      const selectedMatches = matchResults.filter((m) => m.suggested);
      for (const match of selectedMatches) {
        await repaymentService.writeOffRepayment(
          selectedRepayment.id,
          'repayment_plan',
          match.id,
          Math.min(match.amount, selectedRepayment.totalAmount)
        );
      }
      setShowWriteOffModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || '核销失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = (showActions: boolean) => [
    {
      key: 'businessNo',
      title: '业务编号',
      dataIndex: 'businessNo' as keyof Repayment,
      render: (record: Repayment) => (
        <span
          className="font-mono text-sm text-blue-600 cursor-pointer hover:underline"
          onClick={() => navigate(`/case/${record.id}`)}
        >
          {record.businessNo}
        </span>
      ),
    },
    {
      key: 'repaymentDate',
      title: '回款日期',
      dataIndex: 'repaymentDate' as keyof Repayment,
    },
    {
      key: 'totalAmount',
      title: '回款金额',
      dataIndex: 'totalAmount' as keyof Repayment,
      render: (record: Repayment) => (
        <span className="font-medium text-emerald-600">
          ¥{record.totalAmount.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'breakdown',
      title: '金额明细',
      render: (record: Repayment) => (
        <div className="text-xs text-slate-500 space-y-0.5">
          <p>本金: ¥{record.principalPaid.toLocaleString()}</p>
          <p>利息: ¥{record.interestPaid.toLocaleString()}</p>
          {record.penaltyPaid > 0 && <p>罚息: ¥{record.penaltyPaid.toLocaleString()}</p>}
        </div>
      ),
    },
    {
      key: 'payer',
      title: '付款方',
      dataIndex: 'payer' as keyof Repayment,
      render: (record: Repayment) => record.payer || '-',
    },
    {
      key: 'writeOffStatus',
      title: '核销状态',
      render: (record: Repayment) => <WriteOffBadge status={record.writeOffStatus} />,
    },
    {
      key: 'createdAt',
      title: '登记时间',
      dataIndex: 'createdAt' as keyof Repayment,
      render: (record: Repayment) => new Date(record.createdAt).toLocaleString('zh-CN'),
    },
    ...(showActions
      ? [
          {
            key: 'action',
            title: '操作',
            render: (record: Repayment) => (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWriteOff(record);
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  <Check size={12} />
                  核销
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/case/${record.id}`);
                  }}
                  className="flex items-center gap-1 px-2 py-1 border border-slate-300 text-slate-600 text-xs font-medium rounded hover:bg-slate-50 transition-colors"
                >
                  <Eye size={12} />
                  详情
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  if (loading && pendingRepayments.length === 0 && completedRepayments.length === 0) {
    return <Loading size="lg" text="加载回款数据..." className="h-[calc(100vh-180px)]" />;
  }

  if (error && pendingRepayments.length === 0 && completedRepayments.length === 0) {
    return <ErrorState message={error} onRetry={loadData} className="h-[calc(100vh-180px)]" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SearchBar
          placeholder="搜索业务编号..."
          value={searchKeyword}
          onChange={setSearchKeyword}
          onSearch={handleSearch}
          extraButtons={
            <button
              onClick={() => setShowRegisterModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              登记回款
            </button>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="待核销"
          subtitle="需要进行核销处理的回款记录"
          extra={
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-slate-500">{pendingPagination.total} 条</span>
            </div>
          }
        >
          <Table<Repayment>
            columns={columns(true)}
            data={pendingRepayments}
            loading={loading}
            rowKey={(record) => record.id}
            pagination={{
              current: pendingPagination.current,
              pageSize: pendingPagination.pageSize,
              total: pendingPagination.total,
              onChange: (page, pageSize) => setPendingPagination({ ...pendingPagination, current: page, pageSize }),
            }}
          />
        </Card>

        <Card
          title="已核销"
          subtitle="已完成核销处理的回款记录"
          extra={
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-slate-500">{completedPagination.total} 条</span>
            </div>
          }
        >
          <Table<Repayment>
            columns={columns(false)}
            data={completedRepayments}
            loading={loading}
            rowKey={(record) => record.id}
            pagination={{
              current: completedPagination.current,
              pageSize: completedPagination.pageSize,
              total: completedPagination.total,
              onChange: (page, pageSize) => setCompletedPagination({ ...completedPagination, current: page, pageSize }),
            }}
          />
        </Card>
      </div>

      <Modal
        open={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="登记回款"
        width="max-w-xl"
        footer={
          <>
            <button
              onClick={() => setShowRegisterModal(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleRegisterSubmit}
              disabled={submitting}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '提交中...' : '确认登记'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                业务编号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.businessNo}
                onChange={(e) => setFormData({ ...formData, businessNo: e.target.value })}
                placeholder="请输入业务编号"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                回款日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.repaymentDate}
                onChange={(e) => setFormData({ ...formData, repaymentDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                回款总额 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                <input
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">付款方</label>
              <input
                type="text"
                value={formData.payer}
                onChange={(e) => setFormData({ ...formData, payer: e.target.value })}
                placeholder="请输入付款方名称"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">本金</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                <input
                  type="number"
                  value={formData.principalPaid}
                  onChange={(e) => setFormData({ ...formData, principalPaid: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">利息</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                <input
                  type="number"
                  value={formData.interestPaid}
                  onChange={(e) => setFormData({ ...formData, interestPaid: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">罚息</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                <input
                  type="number"
                  value={formData.penaltyPaid}
                  onChange={(e) => setFormData({ ...formData, penaltyPaid: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
            <textarea
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              placeholder="请输入备注信息"
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={showWriteOffModal}
        onClose={() => setShowWriteOffModal(false)}
        title="核销确认"
        width="max-w-2xl"
        footer={
          <>
            <button
              onClick={() => setShowWriteOffModal(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirmWriteOff}
              disabled={submitting || matchResults.filter((m) => m.suggested).length === 0}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '处理中...' : '确认核销'}
            </button>
          </>
        }
      >
        {selectedRepayment && (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">回款信息</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">业务编号：</span>
                  <span className="font-medium text-slate-800">{selectedRepayment.businessNo}</span>
                </div>
                <div>
                  <span className="text-slate-500">回款日期：</span>
                  <span className="font-medium text-slate-800">{selectedRepayment.repaymentDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">回款金额：</span>
                  <span className="font-medium text-emerald-600">
                    ¥{selectedRepayment.totalAmount.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">付款方：</span>
                  <span className="font-medium text-slate-800">{selectedRepayment.payer || '-'}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span className="font-medium text-slate-800">智能匹配结果</span>
                </div>
                <span className="text-xs text-slate-500">系统自动匹配可核销项</span>
              </div>

              <div className="space-y-3">
                {matchResults.map((match) => (
                  <div
                    key={match.id}
                    className={cn(
                      'p-4 border rounded-lg transition-colors',
                      match.suggested
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() =>
                            setMatchResults((prev) =>
                              prev.map((m) => (m.id === match.id ? { ...m, suggested: !m.suggested } : m))
                            )
                          }
                          className={cn(
                            'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                            match.suggested
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-300 hover:border-blue-400'
                          )}
                        >
                          {match.suggested && <Check size={12} />}
                        </button>
                        <div>
                          <p className="font-medium text-slate-800">{match.description}</p>
                          <p className="text-sm text-slate-500 mt-1">
                            {match.type} · 匹配度 {match.matchScore}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-slate-800">¥{match.amount.toLocaleString()}</p>
                        {match.suggested && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs mt-1">
                            <Sparkles size={10} />
                            建议核销
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {matchResults.filter((m) => m.suggested).length > 0 && (
              <div className="p-4 bg-slate-50 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-500">本次核销金额：</span>
                  <span className="text-lg font-bold text-emerald-600 ml-2">
                    ¥
                    {matchResults
                      .filter((m) => m.suggested)
                      .reduce((sum, m) => sum + m.amount, 0)
                      .toLocaleString()}
                  </span>
                </div>
                {matchResults
                    .filter((m) => m.suggested)
                    .reduce((sum, m) => sum + m.amount, 0) < selectedRepayment.totalAmount && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <AlertCircle size={14} />
                    <span>部分回款，剩余 ¥{(selectedRepayment.totalAmount - matchResults.filter((m) => m.suggested).reduce((sum, m) => sum + m.amount, 0)).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
