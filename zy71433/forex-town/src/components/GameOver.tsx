import React from 'react';
import { Trophy, Frown, RotateCcw, BarChart3, TrendingUp, TrendingDown, ShoppingCart, AlertTriangle } from 'lucide-react';
import { useGame } from '../GameContext';
import { formatCurrency, formatPercent } from '../utils';

export const GameOver: React.FC = () => {
  const { state, dispatch } = useGame();

  if (!state.isGameOver) return null;

  const profit = state.cash - state.initialCash;
  const profitRate = (profit / state.initialCash) * 100;
  const isWin = state.gameResult === 'win';

  const totalRevenue = state.roundHistory.reduce((sum, r) => sum + r.revenue, 0);
  const totalCosts = state.roundHistory.reduce((sum, r) => sum + r.costs, 0);
  const totalOrdersCompleted = state.roundHistory.reduce((sum, r) => sum + r.ordersCompleted, 0);
  const totalOrdersDefaulted = state.roundHistory.reduce((sum, r) => sum + r.ordersDefaulted, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-8">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className={`p-8 text-center ${isWin ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-red-50 to-orange-50'}`}>
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${isWin ? 'bg-green-100' : 'bg-red-100'}`}>
            {isWin ? (
              <Trophy className="w-12 h-12 text-green-600" />
            ) : (
              <Frown className="w-12 h-12 text-red-600" />
            )}
          </div>
          <h2 className={`text-3xl font-bold ${isWin ? 'text-green-800' : 'text-red-800'}`}>
            {isWin ? '🎉 经营成功！' : '💔 经营未达目标'}
          </h2>
          <p className={`text-lg mt-2 ${isWin ? 'text-green-600' : 'text-red-600'}`}>
            {isWin ? '恭喜你达成了经营目标！' : '很遗憾，未能达成经营目标。'}
          </p>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-600" /> 最终经营结果
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">初始资金</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(state.initialCash)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">最终资金</p>
                <p className="text-xl font-bold text-primary-600">{formatCurrency(state.cash)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">目标资金</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(state.targetCash)}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-center gap-3">
              <span className="text-gray-600">累计</span>
              <span className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${profit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {formatPercent(profitRate / 100)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-5 border border-green-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-700">累计营收</p>
                  <p className="text-xl font-bold text-green-800">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 rounded-xl p-5 border border-red-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-red-700">累计支出</p>
                  <p className="text-xl font-bold text-red-800">{formatCurrency(totalCosts)}</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-700">订单完成</p>
                  <p className="text-xl font-bold text-blue-800">{totalOrdersCompleted} 笔</p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 rounded-xl p-5 border border-orange-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-orange-700">订单违约</p>
                  <p className="text-xl font-bold text-orange-800">{totalOrdersDefaulted} 笔</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 输赢原因分析</h3>
            <div className="whitespace-pre-line text-gray-700 leading-relaxed">
              {state.finalAnalysis}
            </div>
          </div>

          {state.correctionRecords.length > 0 && (
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">📝 人工修正留痕</h3>
              <p className="text-sm text-blue-700 mb-3">
                经营期间共进行 {state.correctionRecords.length} 次人工修正，所有修改均已记录留痕：
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {state.correctionRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between text-sm bg-white p-3 rounded-lg">
                    <span className="text-blue-800">
                      {record.transactionId} - {record.fieldName}: {String(record.oldValue)} → {String(record.newValue)}
                    </span>
                    <span className="text-blue-600">第{record.round}回合</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => dispatch({ type: 'RESTART_GAME' })}
              className="flex-1 px-6 py-4 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" /> 重新开始
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_TAB', payload: 'review' })}
              className="flex-1 px-6 py-4 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <BarChart3 className="w-5 h-5" /> 查看详细复盘
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
