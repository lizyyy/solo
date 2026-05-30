import React, { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Edit3, Calendar, DollarSign, Package, ShoppingCart } from 'lucide-react';
import { useGame } from '../GameContext';
import { formatCurrency, formatPercent, formatDate } from '../utils';

export const Review: React.FC = () => {
  const { state } = useGame();
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  const totalRevenue = state.roundHistory.reduce((sum, r) => sum + r.revenue, 0);
  const totalCosts = state.roundHistory.reduce((sum, r) => sum + r.costs, 0);
  const totalForexGainLoss = state.roundHistory.reduce((sum, r) => sum + r.forexGainLoss, 0);
  const totalOrdersCompleted = state.roundHistory.reduce((sum, r) => sum + r.ordersCompleted, 0);
  const totalOrdersDefaulted = state.roundHistory.reduce((sum, r) => sum + r.ordersDefaulted, 0);

  const profit = state.cash - state.initialCash;
  const profitRate = (profit / state.initialCash) * 100;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">月底复盘</h2>
          <p className="text-gray-500 mt-1">回顾经营历程，分析决策影响</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">累计营收</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">累计支出</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalCosts)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${totalForexGainLoss >= 0 ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center`}>
              <DollarSign className={`w-6 h-6 ${totalForexGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">汇兑损益</p>
              <p className={`text-2xl font-bold ${totalForexGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalForexGainLoss >= 0 ? '+' : ''}{formatCurrency(totalForexGainLoss)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${profit >= 0 ? 'bg-blue-100' : 'bg-orange-100'} flex items-center justify-center`}>
              <BarChart3 className={`w-6 h-6 ${profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">累计盈利</p>
              <p className={`text-2xl font-bold ${profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
              </p>
              <p className="text-xs text-gray-400">{formatPercent(profitRate / 100)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary-600" /> 订单统计
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <span className="text-gray-600">完成订单</span>
              <span className="text-xl font-bold text-green-600">{totalOrdersCompleted} 笔</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <span className="text-gray-600">违约订单</span>
              <span className="text-xl font-bold text-red-600">{totalOrdersDefaulted} 笔</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <span className="text-gray-600">订单完成率</span>
              <span className="text-xl font-bold text-primary-600">
                {formatPercent(totalOrdersCompleted / Math.max(state.orders.length, 1))}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" /> 异常处理统计
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <span className="text-gray-600">异常总数</span>
              <span className="text-xl font-bold text-gray-900">{state.exceptions.length} 项</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <span className="text-gray-600">已解决</span>
              <span className="text-xl font-bold text-green-600">
                {state.exceptions.filter((e) => e.status === 'resolved' || e.status === 'waived' || e.status === 'confirmed').length} 项
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <span className="text-gray-600">异常处理率</span>
              <span className="text-xl font-bold text-primary-600">
                {formatPercent(
                  state.exceptions.filter((e) => e.status === 'resolved' || e.status === 'waived' || e.status === 'confirmed').length /
                    Math.max(state.exceptions.length, 1)
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {state.correctionRecords.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-600" /> 人工修正记录
            <span className="text-sm font-normal text-gray-500">（月底复盘可翻查）</span>
          </h3>
          <div className="space-y-3">
            {state.correctionRecords.map((record) => (
              <div key={record.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div>
                  <p className="font-medium text-blue-900">
                    {record.transactionId} - {record.fieldName}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    旧值: <code className="bg-white px-1.5 py-0.5 rounded">{String(record.oldValue)}</code> →
                    新值: <code className="bg-white px-1.5 py-0.5 rounded">{String(record.newValue)}</code>
                  </p>
                  <p className="text-sm text-blue-600 mt-1">理由：{record.reason}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-blue-600">{record.operator}</p>
                  <p className="text-xs text-blue-500 mt-1">第{record.round}回合 · {formatDate(record.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600" /> 回合历程
        </h3>
        <div className="space-y-4">
          {state.roundHistory.map((round) => (
            <div
              key={round.round}
              className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                selectedRound === round.round
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-100 bg-gray-50 hover:border-gray-200'
              }`}
              onClick={() => setSelectedRound(selectedRound === round.round ? null : round.round)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    round.cashChange >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {round.round}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">第 {round.round} 回合</p>
                    <p className="text-sm text-gray-500">{round.resultAnalysis}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${round.cashChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {round.cashChange >= 0 ? '+' : ''}{formatCurrency(round.cashChange)}
                  </p>
                  <p className="text-sm text-gray-500">
                    期末 {formatCurrency(round.endCash)}
                  </p>
                </div>
              </div>

              {selectedRound === round.round && (
                <div className="mt-4 pt-4 border-t border-primary-200 grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">营收</p>
                    <p className="text-lg font-semibold text-green-600">{formatCurrency(round.revenue)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">支出</p>
                    <p className="text-lg font-semibold text-red-600">{formatCurrency(round.costs)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">汇兑损益</p>
                    <p className={`text-lg font-semibold ${round.forexGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {round.forexGainLoss >= 0 ? '+' : ''}{formatCurrency(round.forexGainLoss)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">库存价值</p>
                    <p className="text-lg font-semibold text-primary-600">{formatCurrency(round.inventoryValue)}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl border border-primary-200 p-6">
        <h3 className="text-lg font-semibold text-primary-900 mb-4">经营总结分析</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            {profit >= 0 ? (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium text-primary-900">
                {profit >= 0 ? '盈利状况良好' : '出现经营亏损'}
              </p>
              <p className="text-sm text-primary-700 mt-1">
                初始资金 {formatCurrency(state.initialCash)}，当前 {formatCurrency(state.cash)}，
                {profit >= 0 ? '盈利' : '亏损'} {formatPercent(Math.abs(profitRate) / 100)}。
                {profitRate >= 50 ? ' 经营表现优秀！' : profitRate >= 20 ? ' 表现良好，继续保持。' : profitRate >= 0 ? ' 略有盈余，需加强风险管理。' : ' 需要认真复盘，调整经营策略。'}
              </p>
            </div>
          </div>

          {totalOrdersDefaulted > 0 && (
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-primary-900">客户违约风险</p>
                <p className="text-sm text-primary-700 mt-1">
                  共有 {totalOrdersDefaulted} 笔订单违约，建议加强客户信用审核，适当提高低信用客户的预付款比例。
                </p>
              </div>
            </div>
          )}

          {totalForexGainLoss < 0 && (
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-primary-900">汇率风险管理</p>
                <p className="text-sm text-primary-700 mt-1">
                  累计汇兑损失 {formatCurrency(Math.abs(totalForexGainLoss))}，建议合理安排结汇时机，可考虑使用远期结汇等工具对冲汇率风险。
                </p>
              </div>
            </div>
          )}

          {state.inventory.some((i) => i.isOverstock) && (
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-primary-900">库存积压问题</p>
                <p className="text-sm text-primary-700 mt-1">
                  存在库存积压情况，建议优化采购计划，结合销售预测合理控制库存水平，避免资金占用过多。
                </p>
              </div>
            </div>
          )}

          {state.exceptions.filter((e) => e.status === 'pending').length > 0 && (
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-primary-900">待处理异常</p>
                <p className="text-sm text-primary-700 mt-1">
                  还有 {state.exceptions.filter((e) => e.status === 'pending').length} 项异常待处理，
                  请及时处理避免对后续经营造成影响。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
