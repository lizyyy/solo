import React, { useState } from 'react';
import { Play, Database, AlertCircle, TrendingUp, Coins, Award, RefreshCw } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { AlertBox } from '../components/AlertBox';
import { FarmCard } from '../components/FarmCard';
import { PendingTxList } from '../components/PendingTxList';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';

export const Dashboard: React.FC = () => {
  const {
    loading,
    error,
    warnings,
    game,
    farms,
    farmStates,
    currentRoundState,
    initGame,
    startGame,
    loadSampleData,
    loadDefaultData,
    getFarmRanking,
    getTotalCarbonQuota,
    getCurrentCarbonPrice,
    lastSettlementReason,
    isReplaying,
  } = useGameStore();

  const { toasts, showToast, removeToast } = useToast();

  const isGameReady = game !== null && game.status !== 'idle';

  const handleInit = () => {
    initGame();
    showToast('info', '游戏已初始化，请开始第一回合');
  };

  const handleLoadSample = () => {
    loadSampleData();
    showToast('success', '样例数据已加载，包含7回合历史记录');
  };

  const handleStart = () => {
    startGame();
    showToast('success', '第1回合开始！');
  };

  const handleReset = () => {
    if (confirm('确定要重置所有数据吗？此操作不可恢复。')) {
      loadDefaultData();
      showToast('info', '数据已重置');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full">
          <AlertBox type="error" message={error} />
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              恢复默认数据
            </button>
            <button
              onClick={handleLoadSample}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Database className="w-5 h-5" />
              加载样例数据
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isGameReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1
              className="text-4xl font-bold text-gray-800 mb-4"
              style={{ fontFamily: 'ZCOOL XiaoWei, serif' }}
            >
              🌱 碳交易农场经营
            </h1>
            <p className="text-gray-600 text-lg">
              课堂碳交易模拟经营系统，告别纸质计分表
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <button
              onClick={handleLoadSample}
              className="p-6 bg-white border-2 border-green-500 rounded-xl hover:shadow-lg transition-all group"
            >
              <Database className="w-12 h-12 text-green-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">加载样例数据</h3>
              <p className="text-sm text-gray-600">
                包含7回合完整历史，覆盖顺利交易、待确认交易、暂停记录、补录数据等场景
              </p>
              <div className="mt-3 text-xs text-green-600 bg-green-50 px-3 py-1 rounded inline-block">
                推荐：小林老师先跑小包材料
              </div>
            </button>

            <button
              onClick={handleInit}
              className="p-6 bg-white border-2 border-blue-500 rounded-xl hover:shadow-lg transition-all group"
            >
              <Play className="w-12 h-12 text-blue-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">从头开始</h3>
              <p className="text-sm text-gray-600">
                空白开局，从第1回合开始全新的碳交易模拟经营
              </p>
            </button>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              样例数据包含以下场景
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>
                  <strong>顺利记录</strong>（回合3）：青禾农场卖出10吨，价格50元/吨，盈利500元
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-1">✓</span>
                <span>
                  <strong>需人工确认</strong>（回合5）：绿野农庄买入20吨，价格波动超阈值
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-1">✓</span>
                <span>
                  <strong>暂停记录</strong>（回合7）：课堂打断场景，暂停后继续，回合数保持7
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-1">✓</span>
                <span>
                  <strong>旧口径补录</strong>（回合2）：40元→45元/吨，差异清晰展示
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const farmRanking = getFarmRanking();
  const totalQuota = getTotalCarbonQuota();
  const currentPrice = getCurrentCarbonPrice();

  if (!game || farms.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">数据加载失败，请刷新页面重试</p>
      </div>
    );
  }

  const isRunning = game.status === 'running';
  const isPaused = game.status === 'paused';

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {warnings.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-4 space-y-2">
          {warnings.map((warning, index) => (
            <AlertBox
              key={index}
              type="warning"
              message={warning}
              onClose={() => {}}
            />
          ))}
        </div>
      )}

      {isPaused && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <AlertBox
            type="warning"
            message="游戏已暂停，点击顶部「继续」按钮恢复游戏"
          />
        </div>
      )}

      {isReplaying && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <AlertBox
            type="info"
            message="回放模式：当前正在查看历史回合数据，所有操作已禁用"
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border-2 border-blue-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Coins className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">当前碳价</p>
                <p className="text-2xl font-bold text-blue-700">¥{currentPrice}/吨</p>
              </div>
            </div>
            {currentRoundState && currentRoundState.priceFluctuation !== 0 && (
              <p
                className={`text-sm ${
                  currentRoundState.priceFluctuation > 0
                    ? 'text-red-500'
                    : 'text-green-500'
                }`}
              >
                较上回合 {currentRoundState.priceFluctuation > 0 ? '↑' : '↓'}{' '}
                {Math.abs(currentRoundState.priceFluctuation)}%
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 border-2 border-green-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">市场总配额</p>
                <p className="text-2xl font-bold text-green-700">{totalQuota} 吨</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {farms.length} 个农场参与交易
            </p>
          </div>

          <div className="bg-white rounded-xl p-5 border-2 border-yellow-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">当前排名</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {farmRanking[0]?.farm.name || '-'}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              收益: ¥{farmRanking[0]?.state?.revenue || 0}
            </p>
          </div>
        </div>

        {game.status === 'idle' && (
          <div className="bg-white rounded-xl p-8 text-center border-2 border-dashed border-gray-300 mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">准备开始</h3>
            <p className="text-gray-600 mb-6">
              所有农场已就绪，点击下方按钮开始第1回合
            </p>
            <button
              onClick={handleStart}
              className="px-8 py-4 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-600 active:bg-green-700 transition-all flex items-center gap-2 mx-auto"
            >
              <Play className="w-6 h-6" />
              开始第1回合
            </button>
          </div>
        )}

        {lastSettlementReason && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <span className="font-medium">上次结算原因：</span>
              {lastSettlementReason}
            </p>
          </div>
        )}

        <PendingTxList onSuccess={(msg) => showToast('success', msg)} />

        <h2 className="text-xl font-bold text-gray-800 mb-4 mt-6">农场排行</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farmRanking.map(({ farm, state, rank }) => (
            <FarmCard
              key={farm.id}
              farm={farm}
              state={state}
              rank={rank}
              disabled={!isRunning || isReplaying}
            />
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            重置所有数据
          </button>
        </div>
      </div>
    </div>
  );
};
