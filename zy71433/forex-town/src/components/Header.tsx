import React from 'react';
import { Building2, RotateCcw, TrendingUp, Wallet } from 'lucide-react';
import { useGame } from '../GameContext';
import { formatCurrency } from '../utils';

export const Header: React.FC = () => {
  const { state, dispatch } = useGame();

  const handleRestart = () => {
    if (window.confirm('确定要重新开始游戏吗？所有进度将丢失。')) {
      dispatch({ type: 'RESTART_GAME' });
    }
  };

  const progress = (state.currentRound / state.totalRounds) * 100;
  const cashProgress = ((state.cash - state.initialCash) / (state.targetCash - state.initialCash)) * 100;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">外汇小镇经营局</h1>
              <p className="text-sm text-gray-500">商学院进出口贸易模拟实训系统</p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">经营回合</div>
                <div className="text-lg font-bold text-gray-900">
                  {state.currentRound} / {state.totalRounds}
                </div>
                <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="h-12 w-px bg-gray-200" />

              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1">
                  <Wallet className="w-3 h-3" /> 现金余额
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {formatCurrency(state.cash)}
                </div>
                <div className="w-32 h-2 bg-gray-200 rounded-full mt-1">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      cashProgress >= 100 ? 'bg-green-500' : cashProgress >= 0 ? 'bg-primary-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(Math.max(cashProgress, 0), 100)}%` }}
                  />
                </div>
              </div>

              <div className="h-12 w-px bg-gray-200" />

              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3" /> 目标
                </div>
                <div className="text-lg font-bold text-primary-600">
                  {formatCurrency(state.targetCash)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {state.cash >= state.targetCash ? (
                    <span className="text-green-600 font-medium">✓ 已达成</span>
                  ) : (
                    <span>还差 {formatCurrency(state.targetCash - state.cash)}</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-sm">重新开始</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
