import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { Timeline } from '../components/Timeline';
import { AlertBox } from '../components/AlertBox';

export const History: React.FC = () => {
  const { rounds, pauseRecords, supplementRecords, transactions, game, isReplaying } =
    useGameStore();

  if (!game || rounds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-gray-500 mb-4">暂无历史记录</p>
          <p className="text-sm text-gray-400">
            请先在主控台加载样例数据或开始游戏
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {isReplaying && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <AlertBox
            type="info"
            message={`正在回放第 ${game.currentRound} 回合的历史数据`}
          />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 pt-6">
        <h1
          className="text-2xl font-bold text-gray-800 mb-2"
          style={{ fontFamily: 'ZCOOL XiaoWei, serif' }}
        >
          📜 历史记录
        </h1>
        <p className="text-gray-600 mb-6">
          共 {rounds.length} 个回合，{transactions.length} 笔交易，{pauseRecords.length} 次暂停，
          {supplementRecords.length} 条补录
        </p>

        <Timeline
          rounds={rounds}
          pauseRecords={pauseRecords}
          supplementRecords={supplementRecords}
          transactions={transactions}
          currentRound={game.currentRound}
        />
      </div>
    </div>
  );
};
