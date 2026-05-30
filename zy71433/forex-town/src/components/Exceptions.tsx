import React, { useState } from 'react';
import { AlertTriangle, TrendingDown, Package, UserX, FileX, Clock, CheckCircle, ShieldCheck, Eye, Edit3 } from 'lucide-react';
import { useGame } from '../GameContext';
import { formatCurrency, getExceptionTypeLabel, getExceptionStatusLabel, getExceptionStatusColor } from '../utils';
import type { ExceptionItem } from '../types';

type FilterType = 'all' | 'pending' | 'confirmed' | 'waived' | 'resolved';

export const Exceptions: React.FC = () => {
  const { state, dispatch } = useGame();
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedException, setSelectedException] = useState<ExceptionItem | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolution, setResolution] = useState('');

  const filteredExceptions = state.exceptions.filter((e) => {
    if (filter === 'all') return true;
    return e.status === filter;
  });

  const getTypeIcon = (type: ExceptionItem['type']) => {
    const icons = {
      forex_loss: TrendingDown,
      inventory_overstock: Package,
      customer_default: UserX,
      missing_fields: FileX,
      late_submission: Clock,
    };
    return icons[type];
  };

  const getTypeColor = (type: ExceptionItem['type']) => {
    const colors = {
      forex_loss: 'from-red-500 to-red-600',
      inventory_overstock: 'from-orange-500 to-orange-600',
      customer_default: 'from-rose-500 to-rose-600',
      missing_fields: 'from-amber-500 to-amber-600',
      late_submission: 'from-yellow-500 to-yellow-600',
    };
    return colors[type];
  };

  const handleConfirm = (exceptionId: string) => {
    dispatch({
      type: 'CONFIRM_EXCEPTION',
      payload: { exceptionId },
    });
    setSelectedException(null);
  };

  const handleResolve = () => {
    if (!selectedException || !resolution) return;
    dispatch({
      type: 'RESOLVE_EXCEPTION',
      payload: {
        exceptionId: selectedException.id,
        resolution,
        operator: '玩家',
      },
    });
    setShowResolveModal(false);
    setResolution('');
    setSelectedException(null);
  };

  const pendingCount = state.exceptions.filter((e) => e.status === 'pending').length;
  const confirmedCount = state.exceptions.filter((e) => e.status === 'confirmed').length;
  const resolvedCount = state.exceptions.filter((e) => e.status === 'resolved' || e.status === 'waived').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">异常清单</h2>
          <p className="text-gray-500 mt-1">汇率亏损、库存积压、客户违约等风险项处理</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待处理</p>
              <p className="text-2xl font-bold text-red-600">{pendingCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <Eye className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已确认</p>
              <p className="text-2xl font-bold text-orange-600">{confirmedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已解决</p>
              <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">总计</p>
              <p className="text-2xl font-bold text-gray-900">{state.exceptions.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'pending', 'confirmed', 'waived', 'resolved'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {f === 'all' ? '全部' : getExceptionStatusLabel(f)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredExceptions.map((exception) => {
          const TypeIcon = getTypeIcon(exception.type);
          return (
            <div
              key={exception.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getTypeColor(exception.type)} flex items-center justify-center flex-shrink-0`}>
                  <TypeIcon className="w-6 h-6 text-white" />
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">{exception.title}</h3>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getExceptionStatusColor(exception.status)}`}>
                          {exception.status === 'pending' && <AlertTriangle className="w-3 h-3" />}
                          {exception.status === 'resolved' && <CheckCircle className="w-3 h-3" />}
                          {exception.status === 'waived' && <ShieldCheck className="w-3 h-3" />}
                          {getExceptionStatusLabel(exception.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {getExceptionTypeLabel(exception.type)} · 第{exception.round}回合发现
                      </p>
                    </div>
                    {exception.amount && (
                      <div className="text-right">
                        <p className="text-sm text-gray-500">涉及金额</p>
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(exception.amount, exception.currency)}
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-gray-600 mt-3 leading-relaxed">{exception.description}</p>

                  {exception.resolvedRound && (
                    <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-800">处理结果</p>
                          <p className="text-sm text-green-700 mt-1">{exception.resolution}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-green-600">{exception.operator}</p>
                          <p className="text-xs text-green-500 mt-1">第{exception.resolvedRound}回合处理</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {exception.status === 'pending' && (
                    <div className="mt-4 flex gap-3">
                      {exception.type === 'forex_loss' && (
                        <button
                          onClick={() => handleConfirm(exception.id)}
                          className="px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" /> 确认损失
                        </button>
                      )}
                      {exception.type === 'customer_default' && (
                        <button
                          onClick={() => dispatch({ type: 'SET_TAB', payload: 'orders' })}
                          className="px-4 py-2 bg-rose-500 text-white font-medium rounded-lg hover:bg-rose-600 transition-colors flex items-center gap-2"
                        >
                          <UserX className="w-4 h-4" /> 前往催收
                        </button>
                      )}
                      {(exception.type === 'missing_fields' || exception.type === 'late_submission') && (
                        <button
                          onClick={() => dispatch({ type: 'SET_TAB', payload: 'orders' })}
                          className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
                        >
                          <Edit3 className="w-4 h-4" /> 补录信息
                        </button>
                      )}
                      {exception.type === 'inventory_overstock' && (
                        <button
                          onClick={() => dispatch({ type: 'SET_TAB', payload: 'inventory' })}
                          className="px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                        >
                          <Package className="w-4 h-4" /> 查看库存
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedException(exception);
                          setShowResolveModal(true);
                        }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> 标记已解决
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredExceptions.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无异常</h3>
            <p className="text-gray-500">当前筛选条件下没有异常记录</p>
          </div>
        )}
      </div>

      {showResolveModal && selectedException && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[500px] shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">标记异常为已解决</h3>
            <p className="text-gray-500 mb-6">{selectedException.title}</p>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-2">异常描述</p>
                <p className="text-gray-700">{selectedException.description}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">处理方案</label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={4}
                  placeholder="请输入处理方案和结果，将留痕备查"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowResolveModal(false);
                  setResolution('');
                }}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleResolve}
                disabled={!resolution}
                className="flex-1 px-4 py-3 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> 确认解决
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
