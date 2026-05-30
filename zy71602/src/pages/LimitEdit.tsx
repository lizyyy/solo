import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, AlertTriangle, CheckCircle2, History } from 'lucide-react';
import { useLimitStore } from '../store/limitStore';
import { StatusBadge, RiskBadge } from '../components/StatusBadge';
import { formatMoney, formatDateTime } from '../utils/format';
import { LimitStatus } from '../types';
import { cn } from '@/lib/utils';

export const LimitEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const walletLimit = useLimitStore((state) => state.getWalletLimitById(id || ''));
  const histories = useLimitStore((state) => state.getHistoriesByWalletId(id || ''));
  const getEffectiveLimit = useLimitStore((state) => state.getEffectiveLimit);
  const updateWalletLimit = useLimitStore((state) => state.updateWalletLimit);
  const currentOperator = useLimitStore((state) => state.currentOperator);

  const [dailyLimit, setDailyLimit] = useState(walletLimit?.dailyLimit.toString() || '');
  const [singleLimit, setSingleLimit] = useState(walletLimit?.singleLimit.toString() || '');
  const [status, setStatus] = useState<LimitStatus>(walletLimit?.status || 'pending');
  const [remark, setRemark] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  const effectiveLimit = getEffectiveLimit(id || '');
  const lastHistory = histories[0];

  const handleSubmit = () => {
    setShowConfirm(true);
  };

  const confirmSave = () => {
    updateWalletLimit(
      id || '',
      {
        dailyLimit: Number(dailyLimit),
        singleLimit: Number(singleLimit),
        status,
      },
      remark || '无备注'
    );
    setSaveSuccess(true);
    setShowConfirm(false);

    setTimeout(() => {
      navigate(`/detail/${id}`);
    }, 1500);
  };

  const hasChanges =
    Number(dailyLimit) !== walletLimit.dailyLimit ||
    Number(singleLimit) !== walletLimit.singleLimit ||
    status !== walletLimit.status;

  const statusOptions: { value: LimitStatus; label: string; color: string }[] = [
    { value: 'pending', label: '待处理', color: 'bg-amber-500' },
    { value: 'processing', label: '处理中', color: 'bg-blue-500' },
    { value: 'approved', label: '已通过', color: 'bg-emerald-500' },
    { value: 'rejected', label: '已拒绝', color: 'bg-red-500' },
    { value: 'to_confirm', label: '待确认', color: 'bg-orange-500' },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/detail/${id}`)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900">修正限额</h1>
                  {saveSuccess && (
                    <span className="flex items-center gap-1 text-emerald-600 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      保存成功
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 font-mono mt-0.5">
                  {walletLimit.walletAccount} - {walletLimit.walletName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/detail/${id}`}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                取消
              </Link>
              <button
                onClick={handleSubmit}
                disabled={!hasChanges}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  hasChanges
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                )}
              >
                <Save className="w-4 h-4" />
                保存修改
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-6">限额参数</h2>

            {effectiveLimit.isWhitelistActive && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-amber-800">白名单生效中</div>
                    <div className="text-xs text-amber-600 mt-1">
                      当前生效临时日限额 {formatMoney(effectiveLimit.dailyLimit)}，单笔限额{' '}
                      {formatMoney(effectiveLimit.singleLimit)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  日限额（元）
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {Number(dailyLimit) !== walletLimit.dailyLimit && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600">
                      已修改
                    </span>
                  )}
                </div>
                {lastHistory && (
                  <div className="mt-2 text-xs text-slate-500">
                    上次变更：{formatMoney(lastHistory.beforeDailyLimit)} →{' '}
                    {formatMoney(lastHistory.afterDailyLimit)}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  单笔限额（元）
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={singleLimit}
                    onChange={(e) => setSingleLimit(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {Number(singleLimit) !== walletLimit.singleLimit && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600">
                      已修改
                    </span>
                  )}
                </div>
                {lastHistory && (
                  <div className="mt-2 text-xs text-slate-500">
                    上次变更：{formatMoney(lastHistory.beforeSingleLimit)} →{' '}
                    {formatMoney(lastHistory.afterSingleLimit)}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">状态</label>
                <div className="grid grid-cols-5 gap-2">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setStatus(option.value)}
                      className={cn(
                        'py-2 px-3 rounded-lg text-sm font-medium transition-all border-2',
                        status === option.value
                          ? `${option.color} text-white border-transparent`
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  风控备注 <span className="text-slate-400">（必填）</span>
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="请详细说明调整原因和依据..."
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <div className="mt-2 text-xs text-slate-400">
                  操作人：{currentOperator} | 操作时间：{formatDateTime(new Date().toISOString())}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-400" />
                修改预览
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-500">日限额</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'font-mono',
                        Number(dailyLimit) !== walletLimit.dailyLimit
                          ? 'text-slate-400 line-through'
                          : 'text-slate-700'
                      )}
                    >
                      {formatMoney(walletLimit.dailyLimit)}
                    </span>
                    {Number(dailyLimit) !== walletLimit.dailyLimit && (
                      <span className="font-mono font-semibold text-emerald-600">
                        {formatMoney(Number(dailyLimit))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-500">单笔限额</span>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'font-mono',
                        Number(singleLimit) !== walletLimit.singleLimit
                          ? 'text-slate-400 line-through'
                          : 'text-slate-700'
                      )}
                    >
                      {formatMoney(walletLimit.singleLimit)}
                    </span>
                    {Number(singleLimit) !== walletLimit.singleLimit && (
                      <span className="font-mono font-semibold text-emerald-600">
                        {formatMoney(Number(singleLimit))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-500">状态</span>
                  <div className="flex items-center gap-3">
                    {status !== walletLimit.status && (
                      <StatusBadge status={walletLimit.status} size="sm" />
                    )}
                    <StatusBadge status={status} size="sm" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-500">风险等级</span>
                  <RiskBadge level={walletLimit.riskLevel} size="sm" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-900 mb-4">最近变更记录</h2>
              <div className="space-y-3">
                {histories.slice(0, 3).map((history) => (
                  <div key={history.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        {history.operator}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDateTime(history.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{history.remark}</div>
                  </div>
                ))}
                {histories.length === 0 && (
                  <div className="text-center py-4 text-sm text-slate-400">暂无变更记录</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">确认保存修改？</h3>
            <div className="space-y-3 mb-6 text-sm text-slate-600">
              <p>请确认以下修改信息：</p>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span>日限额</span>
                  <span className="font-mono">{formatMoney(Number(dailyLimit))}</span>
                </div>
                <div className="flex justify-between">
                  <span>单笔限额</span>
                  <span className="font-mono">{formatMoney(Number(singleLimit))}</span>
                </div>
                <div className="flex justify-between">
                  <span>状态</span>
                  <StatusBadge status={status} size="sm" />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                修改后将自动记录变更历史，无法撤销。
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
