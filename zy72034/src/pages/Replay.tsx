import React, { useState } from 'react';
import { Play, Info } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { ReplayPlayer } from '../components/ReplayPlayer';
import { AlertBox } from '../components/AlertBox';
import { FarmCard } from '../components/FarmCard';
import { getRoundFarmStates } from '../utils/snapshot';

export const Replay: React.FC = () => {
  const {
    game,
    farms,
    rounds,
    farmStates,
    currentRoundState,
    isReplaying,
    replayRound,
    startReplay,
    stopReplay,
    getFarmRanking,
  } = useGameStore();

  const [selectedStartRound, setSelectedStartRound] = useState(1);

  if (!game || farms.length === 0 || rounds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-gray-500 mb-4">请先在主控台加载数据或开始游戏</p>
        </div>
      </div>
    );
  }

  const handleStartReplay = () => {
    startReplay(selectedStartRound);
  };

  const handleCloseReplay = () => {
    stopReplay();
  };

  const displayRound = isReplaying && replayRound ? replayRound : game.currentRound;
  const currentStates = getRoundFarmStates(farmStates, displayRound);
  const currentRound = rounds.find((r) => r.roundNumber === displayRound);
  const farmRanking = getFarmRanking();

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {isReplaying && <ReplayPlayer onClose={handleCloseReplay} />}

      <div className="max-w-7xl mx-auto px-4 pt-6">
        <h1
          className="text-2xl font-bold text-gray-800 mb-2"
          style={{ fontFamily: 'ZCOOL XiaoWei, serif' }}
        >
          🎬 历史回放
        </h1>
        <p className="text-gray-600 mb-6">
          按回合回放历史数据，支持自动播放和手动切换
        </p>

        {!isReplaying && (
          <>
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">选择回放起点</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    从第几回合开始回放
                  </label>
                  <select
                    value={selectedStartRound}
                    onChange={(e) =>
                      setSelectedStartRound(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-green-500"
                  >
                    {Array.from(
                      { length: game.currentRound },
                      (_, i) => i + 1
                    ).map((r) => (
                      <option key={r} value={r}>
                        第 {r} 回合
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleStartReplay}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 active:bg-green-700 transition-all"
                  >
                    <Play className="w-5 h-5" />
                    开始回放
                  </button>
                </div>
              </div>
            </div>

            <AlertBox
              type="info"
              message="回放模式下，所有操作将被禁用。您可以查看任意回合的完整状态，包括农场数据、交易记录、暂停和补录信息。"
            />
          </>
        )}

        {isReplaying && replayRound && (
          <>
            {currentRound && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-blue-800">
                    正在回放第 {replayRound} 回合
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">碳价:</span>
                    <span className="font-bold text-blue-700 ml-1">
                      ¥{currentRound.carbonPrice}/吨
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">价格波动:</span>
                    <span
                      className={`font-bold ml-1 ${
                        currentRound.priceFluctuation > 0
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {currentRound.priceFluctuation > 0 ? '+' : ''}
                      {currentRound.priceFluctuation}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">开始时间:</span>
                    <span className="font-medium ml-1">
                      {new Date(
                        currentRound.startTime
                      ).toLocaleTimeString('zh-CN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">是否补录:</span>
                    <span
                      className={`font-medium ml-1 ${
                        currentRound.isSupplemented
                          ? 'text-purple-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {currentRound.isSupplemented ? '是' : '否'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-white rounded">
                  <span className="text-sm text-gray-600 font-medium">
                    结算原因:
                  </span>
                  <span className="text-sm text-gray-800 ml-1">
                    {currentRound.settlementReason}
                  </span>
                </div>
              </div>
            )}

            <h2 className="text-lg font-bold text-gray-700 mb-4">
              第 {replayRound} 回合农场状态
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {farms.map((farm) => {
                const state = currentStates.find(
                  (fs) => fs.farmId === farm.id
                );
                const rankItem = farmRanking.find(
                  (r) => r.farm.id === farm.id
                );
                return (
                  <FarmCard
                    key={farm.id}
                    farm={farm}
                    state={state}
                    rank={rankItem?.rank}
                    disabled={true}
                  />
                );
              })}
            </div>
          </>
        )}

        {!isReplaying && rounds.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-700 mb-4">
              可用回合一览
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
              {rounds.map((round) => (
                <button
                  key={round.roundNumber}
                  onClick={() => setSelectedStartRound(round.roundNumber)}
                  className={`p-3 rounded-lg text-center transition-all ${
                    selectedStartRound === round.roundNumber
                      ? 'bg-green-500 text-white shadow-lg'
                      : 'bg-white border-2 border-gray-200 hover:border-green-300'
                  }`}
                >
                  <div className="text-xl font-bold">R{round.roundNumber}</div>
                  <div className="text-xs opacity-75">¥{round.carbonPrice}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
