import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  FileCheck,
  History,
  AlertTriangle,
  Wrench,
  ShieldCheck,
  Download,
  RefreshCw,
  Plus,
  Layers,
  ChevronRight,
  User,
  Clock,
  DollarSign,
  Hash,
  Tag,
  CheckCircle,
} from 'lucide-react';
import { useBusinessStore } from '@/store/businessStore';
import { StatusBadge } from '@/components/StatusBadge';
import { RiskIndicator } from '@/components/RiskIndicator';
import { IssueCard } from '@/components/IssueCard';
import { Timeline } from '@/components/Timeline';
import { VersionCompare } from '@/components/VersionCompare';
import { ActionModal } from '@/components/ActionModal';
import {
  ISSUE_TYPE_LABELS,
  ACTION_LABELS,
  getPurposeCategory,
} from '@/constants/purposeCodes';
import { getAvailableActions, getStatusDescription } from '@/services/stateMachine';
import { AuditAction } from '@/types';
import Empty from '@/components/Empty';

type TabType = 'detect' | 'correct' | 'confirm';

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('detect');
  const [selectedAction, setSelectedAction] = useState<AuditAction | null>(null);
  const [compareVersions, setCompareVersions] = useState<{ v1: number; v2: number } | null>(null);
  const [showVersionCompare, setShowVersionCompare] = useState(false);
  const [supplementTab, setSupplementTab] = useState<'contracts' | 'invoices' | 'applications'>('contracts');

  const {
    getBusinessById,
    currentUser,
    performAction,
    exportConclusion,
    getBusinessObjects,
  } = useBusinessStore();

  const business = id ? getBusinessById(id) : undefined;
  const allBusiness = getBusinessObjects();

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Empty message="业务不存在或已被删除" onBack={() => navigate('/')} />
      </div>
    );
  }

  const availableActions = getAvailableActions(business.status, currentUser.role);

  const openIssues = business.issues.filter((i) => i.status === 'open');
  const resolvedIssues = business.issues.filter((i) => i.status !== 'open');

  const duplicateBusinesses = business.duplicateWith
    ? allBusiness.filter((b) => business.duplicateWith?.includes(b.id))
    : [];

  const handleExport = () => {
    const report = exportConclusion(business.id);
    if (!report) {
      alert('暂无审核结论可导出');
      return;
    }
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `核验报告_${business.businessNo}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAction = (action: AuditAction) => {
    if (action === 'export') {
      handleExport();
    } else if (action === 'recheck') {
      performAction(business.id, 'recheck', '重新校验');
    } else {
      setSelectedAction(action);
    }
  };

  const tabs = [
    {
      id: 'detect' as TabType,
      label: '发现问题',
      icon: AlertTriangle,
      count: openIssues.length,
      color: 'text-rose-600',
      bgActive: 'bg-rose-50 border-rose-200',
    },
    {
      id: 'correct' as TabType,
      label: '修正处理',
      icon: Wrench,
      count: business.supplementRecords.length,
      color: 'text-amber-600',
      bgActive: 'bg-amber-50 border-amber-200',
    },
    {
      id: 'confirm' as TabType,
      label: '确认审计',
      icon: ShieldCheck,
      count: business.conclusion ? 1 : 0,
      color: 'text-emerald-600',
      bgActive: 'bg-emerald-50 border-emerald-200',
    },
  ];

  const versions = Array.from(
    { length: business.currentVersion },
    (_, i) => i + 1
  ).reverse();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-slate-600" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-800">
                    {business.businessNo}
                  </h1>
                  <StatusBadge status={business.status} />
                  <RiskIndicator level={business.riskLevel} />
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {getStatusDescription(business.status)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => performAction(business.id, 'recheck', '手动触发重新校验')}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <RefreshCw size={16} />
                重新校验
              </button>
              <div className="h-6 w-px bg-slate-200" />
              {availableActions.map((action) => (
                <button
                  key={action}
                  onClick={() => handleAction(action)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                    action === 'review_pass' || action === 'confirm'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : action === 'review_reject' || action === 'withdraw'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : action === 'export'
                      ? 'bg-slate-600 text-white hover:bg-slate-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {action === 'export' && <Download size={16} />}
                  {action === 'request_supplement' && <Plus size={16} />}
                  {ACTION_LABELS[action] || action}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <User size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">客户: </span>
              <span className="text-sm font-medium text-slate-800">{business.customerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">金额: </span>
              <span className="text-sm font-semibold text-slate-800">
                {business.amount.toLocaleString()} {business.currency}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">用途: </span>
              <span className="text-sm font-medium text-slate-800">
                {business.purposeCode} - {business.purposeName}
              </span>
              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                {getPurposeCategory(business.purposeCode)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">版本: </span>
              <span className="text-sm font-medium text-slate-800">v{business.currentVersion}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500">
                创建于 {new Date(business.createdAt).toLocaleString('zh-CN')}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-slate-200 mb-6">
              <div className="flex border-b border-slate-200">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                        isActive
                          ? `${tab.color} ${tab.bgActive} border-current`
                          : 'text-slate-500 hover:text-slate-700 border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={18} />
                      {tab.label}
                      {tab.count > 0 && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isActive
                              ? 'bg-white text-inherit'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-6">
                {activeTab === 'detect' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <AlertTriangle className="text-rose-500" size={20} />
                        待处理问题 ({openIssues.length})
                      </h3>
                      {openIssues.length === 0 ? (
                        <div className="text-center py-8 bg-emerald-50 rounded-lg border border-emerald-200">
                          <FileCheck className="mx-auto text-emerald-500 mb-2" size={40} />
                          <p className="text-emerald-700 font-medium">所有问题已处理完毕</p>
                          <p className="text-sm text-emerald-600 mt-1">可以提交复核</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {openIssues.map((issue) => (
                            <IssueCard
                              key={issue.id}
                              issue={issue}
                              businessId={business.id}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {resolvedIssues.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                          <CheckCircle className="text-slate-400" size={20} />
                          已处理问题 ({resolvedIssues.length})
                        </h3>
                        <div className="space-y-3">
                          {resolvedIssues.map((issue) => (
                            <IssueCard
                              key={issue.id}
                              issue={issue}
                              businessId={business.id}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {duplicateBusinesses.length > 0 && (
                      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <h4 className="font-medium text-purple-800 mb-3 flex items-center gap-2">
                          <Hash size={18} />
                          疑似重复汇款的业务
                        </h4>
                        <div className="space-y-2">
                          {duplicateBusinesses.map((dup) => (
                            <button
                              key={dup.id}
                              onClick={() => navigate(`/detail/${dup.id}`)}
                              className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-purple-100 hover:border-purple-300 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-slate-800">{dup.businessNo}</span>
                                <span className="text-sm text-slate-500">{dup.customerName}</span>
                                <span className="text-sm font-medium text-slate-700">
                                  {dup.amount.toLocaleString()} {dup.currency}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <StatusBadge status={dup.status} />
                                <ChevronRight size={16} className="text-slate-400" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'correct' && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                          <Layers className="text-amber-500" size={20} />
                          材料版本管理
                        </h3>
                        <button
                          onClick={() => setShowVersionCompare(!showVersionCompare)}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          <RefreshCw size={14} />
                          {showVersionCompare ? '隐藏对比' : '版本对比'}
                        </button>
                      </div>

                      {showVersionCompare && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-4 mb-4">
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">版本1</label>
                              <select
                                value={compareVersions?.v1 || ''}
                                onChange={(e) =>
                                  setCompareVersions({
                                    v1: parseInt(e.target.value),
                                    v2: compareVersions?.v2 || business.currentVersion,
                                  })
                                }
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              >
                                <option value="">选择版本</option>
                                {versions.map((v) => (
                                  <option key={v} value={v}>
                                    v{v}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <ChevronRight className="text-slate-400 mt-6" size={20} />
                            <div>
                              <label className="block text-sm text-slate-600 mb-1">版本2</label>
                              <select
                                value={compareVersions?.v2 || ''}
                                onChange={(e) =>
                                  setCompareVersions({
                                    v1: compareVersions?.v1 || 1,
                                    v2: parseInt(e.target.value),
                                  })
                                }
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              >
                                <option value="">选择版本</option>
                                {versions.map((v) => (
                                  <option key={v} value={v}>
                                    v{v}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {compareVersions && (
                            <VersionCompare
                              business={business}
                              version1={compareVersions.v1}
                              version2={compareVersions.v2}
                            />
                          )}
                        </div>
                      )}

                      <div className="border-b border-slate-200 mb-4">
                        <div className="flex gap-1">
                          {[
                            { id: 'contracts', label: '合同', count: business.contracts.length },
                            { id: 'invoices', label: '发票', count: business.invoices.length },
                            { id: 'applications', label: '汇款申请', count: business.applications.length },
                          ].map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() =>
                                setSupplementTab(tab.id as 'contracts' | 'invoices' | 'applications')
                              }
                              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                supplementTab === tab.id
                                  ? 'text-blue-600 border-blue-600'
                                  : 'text-slate-500 border-transparent hover:text-slate-700'
                              }`}
                            >
                              {tab.label} ({tab.count})
                            </button>
                          ))}
                        </div>
                      </div>

                      {supplementTab === 'contracts' && (
                        <div className="space-y-3">
                          {business.contracts.map((contract) => (
                            <div
                              key={contract.id}
                              className={`p-4 rounded-lg border transition-colors ${
                                contract.isSupplement
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-semibold text-slate-800">
                                      {contract.contractNo}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                      v{contract.version}
                                    </span>
                                    {contract.isSupplement && (
                                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                        补件
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="text-slate-500">金额: </span>
                                      <span className="font-medium">
                                        {contract.amount.toLocaleString()} {contract.currency}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">日期: </span>
                                      <span>{contract.contractDate}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">签约方: </span>
                                      <span>{contract.signatoryA} ↔ {contract.signatoryB}</span>
                                    </div>
                                  </div>
                                  <p className="mt-2 text-sm text-slate-600">
                                    货物描述: {contract.goodsDescription}
                                  </p>
                                </div>
                                <div className="text-xs text-slate-500">
                                  <div>{contract.uploader}</div>
                                  <div>{new Date(contract.uploadTime).toLocaleString('zh-CN')}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {supplementTab === 'invoices' && (
                        <div className="space-y-3">
                          {business.invoices.map((invoice) => (
                            <div
                              key={invoice.id}
                              className={`p-4 rounded-lg border transition-colors ${
                                invoice.isSupplement
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-semibold text-slate-800">
                                      {invoice.invoiceNo}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                      v{invoice.version}
                                    </span>
                                    {invoice.isSupplement && (
                                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                        补件
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="text-slate-500">金额: </span>
                                      <span className="font-medium">
                                        {invoice.amount.toLocaleString()} {invoice.currency}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">日期: </span>
                                      <span>{invoice.invoiceDate}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">买卖方: </span>
                                      <span>{invoice.sellerName} → {invoice.buyerName}</span>
                                    </div>
                                  </div>
                                  <p className="mt-2 text-sm text-slate-600">
                                    货物描述: {invoice.goodsDescription}
                                  </p>
                                </div>
                                <div className="text-xs text-slate-500">
                                  <div>{invoice.uploader}</div>
                                  <div>{new Date(invoice.uploadTime).toLocaleString('zh-CN')}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {supplementTab === 'applications' && (
                        <div className="space-y-3">
                          {business.applications.map((app) => (
                            <div
                              key={app.id}
                              className="p-4 rounded-lg border bg-white border-slate-200 hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-semibold text-slate-800">
                                      汇款申请
                                    </span>
                                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                      v{app.version}
                                    </span>
                                    {app.version > 1 && (
                                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                        修改
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="text-slate-500">金额: </span>
                                      <span className="font-medium">
                                        {app.amount.toLocaleString()} {app.currency}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">用途: </span>
                                      <span>{app.purposeCode} - {app.purposeDescription}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">收款人: </span>
                                      <span>{app.payeeName}</span>
                                    </div>
                                  </div>
                                  <p className="mt-2 text-sm text-slate-600">
                                    收款银行: {app.payeeBank}
                                  </p>
                                </div>
                                <div className="text-xs text-slate-500">
                                  <div>{app.submitter}</div>
                                  <div>{new Date(app.submitTime).toLocaleString('zh-CN')}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {business.supplementRecords.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                          <FileText className="text-amber-500" size={20} />
                          补件记录 ({business.supplementRecords.length})
                        </h3>
                        <div className="space-y-3">
                          {business.supplementRecords.map((record) => (
                            <div
                              key={record.id}
                              className="p-4 bg-amber-50 rounded-lg border border-amber-200"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-medium text-amber-800">
                                      {record.supplementType === 'contract'
                                        ? '合同补件'
                                        : record.supplementType === 'invoice'
                                        ? '发票补件'
                                        : record.supplementType === 'purpose'
                                        ? '用途修正'
                                        : '其他补件'}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                      v{record.version}
                                    </span>
                                    {record.coversOriginal && (
                                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                        覆盖原件
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-amber-900">{record.reason}</p>
                                </div>
                                <div className="text-xs text-amber-600">
                                  <div>{record.operator}</div>
                                  <div>{new Date(record.operateTime).toLocaleString('zh-CN')}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'confirm' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <ShieldCheck className="text-emerald-500" size={20} />
                        审核结论
                      </h3>
                      {business.conclusion ? (
                        <div
                          className={`p-6 rounded-xl border ${
                            business.conclusion.result === 'pass'
                              ? 'bg-emerald-50 border-emerald-200'
                              : business.conclusion.result === 'reject'
                              ? 'bg-red-50 border-red-200'
                              : 'bg-amber-50 border-amber-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <span
                                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${
                                    business.conclusion.result === 'pass'
                                      ? 'bg-emerald-600 text-white'
                                      : business.conclusion.result === 'reject'
                                      ? 'bg-red-600 text-white'
                                      : 'bg-amber-600 text-white'
                                  }`}
                                >
                                  {business.conclusion.result === 'pass'
                                    ? '✓ 审核通过'
                                    : business.conclusion.result === 'reject'
                                    ? '✗ 审核拒绝'
                                    : '⚠ 需要补件'}
                                </span>
                                {business.conclusion.isFinal && (
                                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs">
                                    最终结论
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-700">{business.conclusion.remark}</p>
                            </div>
                            <button
                              onClick={handleExport}
                              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                            >
                              <Download size={16} />
                              导出报告
                            </button>
                          </div>
                          <div className="flex items-center gap-6 pt-4 border-t border-inherit text-sm">
                            <div>
                              <span className="text-slate-500">审核人: </span>
                              <span className="font-medium">{business.conclusion.auditor}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">审核时间: </span>
                              <span>{new Date(business.conclusion.auditTime).toLocaleString('zh-CN')}</span>
                            </div>
                            {business.conclusion.reviewer && (
                              <div>
                                <span className="text-slate-500">复核人: </span>
                                <span className="font-medium">{business.conclusion.reviewer}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                          <ShieldCheck className="mx-auto text-slate-400 mb-2" size={40} />
                          <p className="text-slate-500">暂无审核结论</p>
                          <p className="text-sm text-slate-400 mt-1">完成所有问题处理并通过复核后将生成结论</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <History className="text-slate-500" size={20} />
                        问题汇总统计
                      </h3>
                      <div className="grid grid-cols-4 gap-4">
                        {Object.entries(ISSUE_TYPE_LABELS).map(([type, label]) => {
                          const count = business.issues.filter((i) => i.type === type).length;
                          const openCount = business.issues.filter(
                            (i) => i.type === type && i.status === 'open'
                          ).length;
                          if (count === 0) return null;
                          return (
                            <div
                              key={type}
                              className="p-4 bg-white rounded-lg border border-slate-200"
                            >
                              <div className="text-2xl font-bold text-slate-800 mb-1">
                                {openCount > 0 ? (
                                  <span className="text-red-600">{openCount}</span>
                                ) : (
                                  <span className="text-emerald-600">0</span>
                                )}
                                <span className="text-sm text-slate-400 font-normal"> / {count}</span>
                              </div>
                              <div className="text-sm text-slate-600">{label}</div>
                            </div>
                          );
                        })}
                        {business.issues.length === 0 && (
                          <div className="col-span-4 text-center py-4 text-slate-500">
                            无问题记录
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <FileCheck className="text-slate-500" size={20} />
                        材料完整性检查
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-white rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-600">合同</span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                business.contracts.length > 0
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {business.contracts.length > 0 ? '✓ 已提供' : '✗ 缺失'}
                            </span>
                          </div>
                          <div className="text-2xl font-bold text-slate-800">
                            {business.contracts.length} 份
                          </div>
                        </div>
                        <div className="p-4 bg-white rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-600">发票</span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                business.invoices.length > 0
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {business.invoices.length > 0 ? '✓ 已提供' : '✗ 缺失'}
                            </span>
                          </div>
                          <div className="text-2xl font-bold text-slate-800">
                            {business.invoices.length} 份
                          </div>
                        </div>
                        <div className="p-4 bg-white rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-600">汇款申请</span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                business.applications.length > 0
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {business.applications.length > 0 ? '✓ 已提供' : '✗ 缺失'}
                            </span>
                          </div>
                          <div className="text-2xl font-bold text-slate-800">
                            {business.applications.length} 份
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-96 flex-shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 sticky top-28">
              <div className="p-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <History size={18} className="text-slate-500" />
                  审核轨迹
                </h3>
              </div>
              <div className="p-4 max-h-[600px] overflow-y-auto">
                <Timeline trails={business.auditTrails} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedAction && (
        <ActionModal
          businessId={business.id}
          action={selectedAction}
          currentStatus={business.status}
          onClose={() => setSelectedAction(null)}
          onSuccess={() => setSelectedAction(null)}
        />
      )}
    </div>
  );
}
