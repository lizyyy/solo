import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Clock,
  History,
  CreditCard,
  FileCheck,
  GitCompare,
  Send,
  X,
  Check,
  DollarSign,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { StatusBadge } from '../components/StatusBadge';
import { StatusTimeline } from '../components/StatusTimeline';
import { EvidenceTimeline } from '../components/EvidenceTimeline';
import { PaymentHistory } from '../components/PaymentHistory';
import { VersionCompare } from '../components/VersionCompare';
import { ApprovalStateMachine } from '../services/ApprovalStateMachine';
import { VersionComparator } from '../services/VersionComparator';
import { DiscountCalculator } from '../services/DiscountCalculator';
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatDateTime,
} from '../utils/format';
import type { ApplicationStatus } from '../types';
import { STATUS_LABELS, SUPPLIER_LEVEL_LABELS } from '../types';

type TabType = 'overview' | 'status' | 'payment' | 'evidence' | 'compare';

export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusRemark, setStatusRemark] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus | null>(null);

  const application = useAppStore((state) => state.getApplicationById(id || ''));
  const transitions = useAppStore((state) => state.getTransitionsByApplicationId(id || ''));
  const payments = useAppStore((state) => state.getPaymentsByApplicationId(id || ''));
  const evidenceItems = useAppStore((state) => state.getEvidenceByApplicationId(id || ''));
  const supplier = useAppStore((state) => state.getSupplierById(application?.supplierId || ''));
  const transitionStatus = useAppStore((state) => state.transitionStatus);
  const recordPayment = useAppStore((state) => state.recordPayment);

  if (!application) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">申请不存在或已被删除</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-primary-600 hover:underline"
        >
          返回列表
        </button>
      </div>
    );
  }

  const availableTransitions = ApprovalStateMachine.getAvailableTransitions(application.status);
  const calc = DiscountCalculator.calculate(
    application.payableAmount,
    application.originalDueDate,
    application.proposedDueDate,
    application.discountRate
  );

  const versionDiffs = VersionComparator.compareVersions(
    { ...application, currentVersion: application.currentVersion - 1 },
    application
  );

  const handleStatusChange = () => {
    if (!selectedStatus) return;
    transitionStatus(application.id, selectedStatus, statusRemark);
    setShowStatusModal(false);
    setSelectedStatus(null);
    setStatusRemark('');
  };

  const handlePayment = () => {
    if (confirm('确认执行付款操作？')) {
      recordPayment(application.id, application.actualPaymentAmount);
    }
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: '概览', icon: FileCheck },
    { id: 'status', label: '状态流转', icon: Clock },
    { id: 'payment', label: '付款记录', icon: CreditCard },
    { id: 'evidence', label: '证据链', icon: History },
    { id: 'compare', label: '版本对比', icon: GitCompare },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-800">
                {application.applicationNo}
              </h2>
              <StatusBadge status={application.status} />
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                v{application.currentVersion}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {application.supplierName} · {SUPPLIER_LEVEL_LABELS[application.supplierLevel]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {availableTransitions.length > 0 && (
            <button
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-700 text-white rounded hover:bg-primary-800 transition-colors"
            >
              <Send size={16} />
              状态操作
            </button>
          )}
          {application.status === 'APPROVED' && (
            <button
              onClick={handlePayment}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-success-600 text-white rounded hover:bg-success-700 transition-colors"
            >
              <DollarSign size={16} />
              执行付款
            </button>
          )}
          <Link
            to={`/application/${application.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            <Edit size={16} />
            编辑
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex gap-1 px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600 font-medium'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="font-medium text-gray-700 mb-4">基本信息</h3>
                <dl className="space-y-3">
                  <div className="flex">
                    <dt className="w-28 text-sm text-gray-500">申请编号</dt>
                    <dd className="text-sm font-mono text-gray-800">
                      {application.applicationNo}
                    </dd>
                  </div>
                  <div className="flex">
                    <dt className="w-28 text-sm text-gray-500">供应商</dt>
                    <dd className="text-sm text-gray-800">
                      {application.supplierName}
                      <span className="ml-2 text-xs text-gray-500">
                        ({SUPPLIER_LEVEL_LABELS[application.supplierLevel]})
                      </span>
                    </dd>
                  </div>
                  <div className="flex">
                    <dt className="w-28 text-sm text-gray-500">应付账款</dt>
                    <dd className="text-sm text-gray-800">{application.payableId}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-28 text-sm text-gray-500">创建人</dt>
                    <dd className="text-sm text-gray-800">{application.createdBy}</dd>
                  </div>
                  <div className="flex">
                    <dt className="w-28 text-sm text-gray-500">创建时间</dt>
                    <dd className="text-sm text-gray-800">
                      {formatDateTime(application.createdAt)}
                    </dd>
                  </div>
                  <div className="flex">
                    <dt className="w-28 text-sm text-gray-500">更新时间</dt>
                    <dd className="text-sm text-gray-800">
                      {formatDateTime(application.updatedAt)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-4">折扣试算</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">应付金额</dt>
                      <dd className="text-sm font-mono font-medium">
                        {formatCurrency(application.payableAmount)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">原到期日</dt>
                      <dd className="text-sm">{formatDate(application.originalDueDate)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">拟付款日</dt>
                      <dd className="text-sm">{formatDate(application.proposedDueDate)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">提前天数</dt>
                      <dd className="text-sm font-mono text-primary-600">
                        {calc.daysEarly} 天
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">年化折扣率</dt>
                      <dd className="text-sm font-mono">{formatPercent(application.discountRate)}</dd>
                    </div>
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="flex justify-between mb-2">
                        <dt className="text-sm text-gray-500">折扣金额</dt>
                        <dd className="text-sm font-mono text-success-600">
                          -{formatCurrency(calc.discountAmount)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">实际付款</dt>
                        <dd className="text-lg font-bold font-mono text-primary-700">
                          {formatCurrency(calc.actualPayment)}
                        </dd>
                      </div>
                      <div className="flex justify-between mt-2">
                        <dt className="text-xs text-gray-400">实际年化收益率</dt>
                        <dd className="text-xs font-mono text-amber-600">
                          {calc.annualizedReturn.toFixed(2)}%
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </div>

              {supplier && (
                <div className="lg:col-span-2">
                  <h3 className="font-medium text-gray-700 mb-3">供应商信息</h3>
                  <div className="bg-primary-50 rounded-lg p-4 flex items-center gap-8">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">信用评级</div>
                      <div className="text-2xl font-bold text-primary-700">
                        {supplier.creditRating}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">历史折扣次数</div>
                      <div className="text-2xl font-bold text-primary-700">
                        {supplier.historicalDiscountCount} 次
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">最大允许折扣率</div>
                      <div className="text-2xl font-bold text-primary-700">
                        {formatPercent(DiscountCalculator.getMaxDiscountRate(supplier.level))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'status' && <StatusTimeline transitions={transitions} />}

          {activeTab === 'payment' && <PaymentHistory payments={payments} />}

          {activeTab === 'evidence' && <EvidenceTimeline items={evidenceItems} />}

          {activeTab === 'compare' && <VersionCompare diffs={versionDiffs} />}
        </div>
      </div>

      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">状态变更</h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">当前状态</label>
              <div>
                <StatusBadge status={application.status} />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">选择目标状态</label>
              <div className="space-y-2">
                {availableTransitions.map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`w-full p-3 text-left rounded border transition-colors ${
                      selectedStatus === status
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{STATUS_LABELS[status]}</span>
                      {selectedStatus === status && (
                        <Check size={18} className="text-primary-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-gray-600 mb-2">变更原因</label>
              <textarea
                value={statusRemark}
                onChange={(e) => setStatusRemark(e.target.value)}
                placeholder="请输入变更原因（必填）"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleStatusChange}
                disabled={!selectedStatus || !statusRemark.trim()}
                className="px-4 py-2 text-sm bg-primary-700 text-white rounded hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认变更
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
