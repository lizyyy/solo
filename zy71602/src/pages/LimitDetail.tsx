import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Download,
  History,
  ShieldAlert,
  CreditCard,
  FileText,
  GitBranch,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLimitStore } from '../store/limitStore';
import { StatusBadge, RiskBadge } from '../components/StatusBadge';
import { formatMoney, formatDateTime, getStatusLabel, getRiskTypeLabel } from '../utils/format';
import { exportToFile } from '../utils/export';
import { ExportFormat } from '../types';
import { cn } from '@/lib/utils';

type TabType = 'overview' | 'transactions' | 'whitelist' | 'history' | 'risks';

export const LimitDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const walletLimit = useLimitStore((state) => state.getWalletLimitById(id || ''));
  const histories = useLimitStore((state) => state.getHistoriesByWalletId(id || ''));
  const transactions = useLimitStore((state) => state.getTransactionsByWalletId(id || ''));
  const whitelistVersions = useLimitStore((state) => state.getWhitelistByWalletId(id || ''));
  const riskMarks = useLimitStore((state) => state.getRiskMarksByWalletId(id || ''));
  const getTransactionSummary = useLimitStore((state) => state.getTransactionSummary);
  const getEffectiveLimit = useLimitStore((state) => state.getEffectiveLimit);
  const resolveRiskMark = useLimitStore((state) => state.resolveRiskMark);
  const addExportRecord = useLimitStore((state) => state.addExportRecord);
  const currentOperator = useLimitStore((state) => state.currentOperator);

  if (!walletLimit) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="w-16 h-16 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">未找到该限额记录</h2>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const transactionSummary = getTransactionSummary(id || '');
  const effectiveLimit = getEffectiveLimit(id || '');
  const usagePercent = (walletLimit.usedDailyLimit / effectiveLimit.dailyLimit) * 100;

  const transactionChartData = transactions.slice(0, 10).map((t) => ({
    time: t.transactionTime.slice(11, 16),
    amount: t.amount / 10000,
    status: t.status,
  }));

  const handleExport = async (format: ExportFormat) => {
    const exportTime = new Date().toISOString();
    const fileName = `限额复核报告-${walletLimit.walletAccount}-${exportTime.slice(0, 10)}`;

    const { contentHash } = exportToFile(
      {
        walletLimit,
        histories,
        transactions,
        whitelistVersions,
        riskMarks,
        exportTime,
        operator: currentOperator,
      },
      format,
      fileName
    );

    addExportRecord({
      walletLimitId: id || '',
      fileName: `${fileName}.${format}`,
      format,
      operator: currentOperator,
      contentHash,
    });

    setShowExportMenu(false);
  };

  const tabs = [
    { id: 'overview' as TabType, label: '概览', icon: BarChart3 },
    { id: 'transactions' as TabType, label: '交易归集', icon: CreditCard },
    { id: 'whitelist' as TabType, label: '白名单版本', icon: GitBranch },
    { id: 'history' as TabType, label: '变更历史', icon: History },
    { id: 'risks' as TabType, label: '风险标记', icon: ShieldAlert },
  ];

  const statusTransitions = [
    { status: 'pending', label: '待处理', time: histories.find((h) => h.afterStatus === 'pending')?.createdAt },
    { status: 'processing', label: '处理中', time: histories.find((h) => h.afterStatus === 'processing')?.createdAt },
    { status: walletLimit.status, label: getStatusLabel(walletLimit.status), time: walletLimit.updatedAt, current: true },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900">{walletLimit.walletName}</h1>
                  <StatusBadge status={walletLimit.status} />
                  <RiskBadge level={walletLimit.riskLevel} />
                </div>
                <p className="text-sm text-slate-500 font-mono mt-0.5">{walletLimit.walletAccount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  导出报告
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px] z-20">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      导出 CSV
                    </button>
                    <button
                      onClick={() => handleExport('xlsx')}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      导出 Excel
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      导出文本报告
                    </button>
                  </div>
                )}
              </div>
              <Link
                to={`/edit/${id}`}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                修正限额
              </Link>
            </div>
          </div>
        </div>

        <div className="px-6 border-t border-slate-100">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    isActive
                      ? 'text-blue-600 border-blue-600'
                      : 'text-slate-500 border-transparent hover:text-slate-700'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-sm text-slate-500 mb-1">日限额</div>
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  {formatMoney(effectiveLimit.dailyLimit)}
                </div>
                {effectiveLimit.isWhitelistActive && (
                  <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    白名单生效中
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-sm text-slate-500 mb-1">单笔限额</div>
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  {formatMoney(effectiveLimit.singleLimit)}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-sm text-slate-500 mb-1">已用额度</div>
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  {formatMoney(walletLimit.usedDailyLimit)}
                </div>
                <div className="mt-2">
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        usagePercent >= 90
                          ? 'bg-red-500'
                          : usagePercent >= 70
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      )}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{usagePercent.toFixed(1)}%</div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-sm text-slate-500 mb-1">今日交易</div>
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  {transactionSummary.successCount} 笔
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  成功 {transactionSummary.successCount} / 待处理 {transactionSummary.pendingCount}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                限额状态机
              </h3>
              <div className="flex items-center gap-4">
                {statusTransitions.map((item, index) => (
                  <React.Fragment key={item.status}>
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-full flex items-center justify-center border-2',
                          item.current
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-300 text-slate-400'
                        )}
                      >
                        {item.current ? <CheckCircle2 className="w-6 h-6" /> : <span className="text-lg">{index + 1}</span>}
                      </div>
                      <span className="text-sm font-medium mt-2 text-slate-700">{item.label}</span>
                      {item.time && (
                        <span className="text-xs text-slate-400 mt-0.5">{formatDateTime(item.time).slice(5)}</span>
                      )}
                    </div>
                    {index < statusTransitions.length - 1 && (
                      <div className="flex-1 h-0.5 bg-slate-200 mx-2" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-slate-400" />
                交易趋势
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={transactionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#64748b" unit="万" />
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(2)} 万`, '金额']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">交易明细</h3>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>成功 {transactionSummary.successCount} 笔</span>
                <span className="text-amber-600">待处理 {transactionSummary.pendingCount} 笔</span>
                <span className="text-red-600">异常 {transactionSummary.abnormalCount} 笔</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          tx.status === 'success'
                            ? 'bg-emerald-100 text-emerald-600'
                            : tx.status === 'pending'
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-red-100 text-red-600'
                        )}
                      >
                        {tx.status === 'success' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : tx.status === 'pending' ? (
                          <Clock className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-mono text-sm font-medium text-slate-900">
                          {tx.transactionNo}
                        </div>
                        <div className="text-sm text-slate-500 mt-0.5">{tx.description}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-slate-900">
                        {formatMoney(tx.amount)}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatDateTime(tx.transactionTime)}</div>
                    </div>
                  </div>
                  {(tx.isDuplicate || tx.isAbnormal) && (
                    <div className="mt-3 flex gap-2">
                      {tx.isDuplicate && (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded">
                          重复交易
                        </span>
                      )}
                      {tx.isAbnormal && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded">
                          异常交易
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'whitelist' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">白名单版本历史</h3>
              <p className="text-sm text-slate-500 mt-1">所有临时白名单配置记录，包含生效和过期时间</p>
            </div>
            <div className="divide-y divide-slate-100">
              {whitelistVersions.map((version, index) => (
                <div key={version.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                          version.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : version.status === 'expired'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-100 text-amber-700'
                        )}
                      >
                        V{version.version}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">版本 {version.version}</span>
                          <span
                            className={cn(
                              'px-2 py-0.5 text-xs rounded',
                              version.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700'
                                : version.status === 'expired'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-amber-100 text-amber-700'
                            )}
                          >
                            {version.status === 'active' ? '生效中' : version.status === 'expired' ? '已过期' : '待生效'}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                          <User className="w-3 h-3" />
                          {version.creator}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-slate-500">创建于 {formatDateTime(version.createdAt)}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">临时日限额</div>
                      <div className="font-mono font-semibold text-slate-900 mt-1">
                        {formatMoney(version.tempDailyLimit)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">临时单笔限额</div>
                      <div className="font-mono font-semibold text-slate-900 mt-1">
                        {formatMoney(version.tempSingleLimit)}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">生效时间</div>
                      <div className="font-mono text-slate-900 mt-1">{formatDateTime(version.effectiveTime)}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500">过期时间</div>
                      <div className="font-mono text-slate-900 mt-1">{formatDateTime(version.expireTime)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {whitelistVersions.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>暂无白名单版本记录</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">变更历史</h3>
              <p className="text-sm text-slate-500 mt-1">所有限额调整和状态变更的完整记录</p>
            </div>
            <div className="p-6">
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
                <div className="space-y-6">
                  {histories.map((history) => (
                    <div key={history.id} className="relative pl-10">
                      <div className="absolute left-2 top-1 w-5 h-5 bg-blue-600 rounded-full border-4 border-white shadow" />
                      <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-900">{history.operator}</span>
                          </div>
                          <span className="text-sm text-slate-500">{formatDateTime(history.createdAt)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">日限额：</span>
                            <span className="font-mono text-slate-700">
                              {formatMoney(history.beforeDailyLimit)}
                            </span>
                            <span className="mx-2 text-slate-400">→</span>
                            <span
                              className={cn(
                                'font-mono font-semibold',
                                history.afterDailyLimit > history.beforeDailyLimit
                                  ? 'text-emerald-600'
                                  : history.afterDailyLimit < history.beforeDailyLimit
                                  ? 'text-red-600'
                                  : 'text-slate-700'
                              )}
                            >
                              {formatMoney(history.afterDailyLimit)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">单笔限额：</span>
                            <span className="font-mono text-slate-700">
                              {formatMoney(history.beforeSingleLimit)}
                            </span>
                            <span className="mx-2 text-slate-400">→</span>
                            <span
                              className={cn(
                                'font-mono font-semibold',
                                history.afterSingleLimit > history.beforeSingleLimit
                                  ? 'text-emerald-600'
                                  : history.afterSingleLimit < history.beforeSingleLimit
                                  ? 'text-red-600'
                                  : 'text-slate-700'
                              )}
                            >
                              {formatMoney(history.afterSingleLimit)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 text-sm">
                          <span className="text-slate-500">状态变更：</span>
                          <StatusBadge status={history.beforeStatus} size="sm" />
                          <span className="mx-2 text-slate-400">→</span>
                          <StatusBadge status={history.afterStatus} size="sm" />
                        </div>
                        {history.remark && (
                          <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                            <div className="text-xs text-slate-500 mb-1">复核备注</div>
                            <div className="text-sm text-slate-700">{history.remark}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'risks' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">风险标记</h3>
                  <p className="text-sm text-slate-500 mt-1">系统自动检测到的风险点，需要人工确认</p>
                </div>
                <span className="text-sm text-slate-500">
                  {riskMarks.filter((r) => !r.isResolved).length} 个待处理
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {riskMarks.map((risk) => (
                  <div key={risk.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                            risk.level === 'critical'
                              ? 'bg-red-100 text-red-600'
                              : risk.level === 'high'
                              ? 'bg-rose-100 text-rose-600'
                              : risk.level === 'medium'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-slate-100 text-slate-600'
                          )}
                        >
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{getRiskTypeLabel(risk.type)}</span>
                            <RiskBadge level={risk.level} size="sm" />
                            {risk.isResolved && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">
                                已解决
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{risk.description}</p>
                          <p className="text-xs text-slate-400 mt-2">{formatDateTime(risk.createdAt)}</p>
                        </div>
                      </div>
                      {!risk.isResolved && (
                        <button
                          onClick={() => resolveRiskMark(risk.id)}
                          className="px-3 py-1.5 text-sm bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          标记已解决
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {riskMarks.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
                    <p className="text-emerald-600 font-medium">暂无风险标记</p>
                    <p className="text-sm mt-1">该钱包限额状态正常</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
