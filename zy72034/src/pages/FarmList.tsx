import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { FarmCard } from '../components/FarmCard';
import { TradeForm } from '../components/TradeForm';
import { ToastContainer } from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';
import { getRoundFarmStates } from '../utils/snapshot';
import { AlertBox } from '../components/AlertBox';

export const FarmList: React.FC = () => {
  const { farms, farmStates, game, isReplaying } = useGameStore();
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const { toasts, showToast, removeToast } = useToast();

  if (!game || farms.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">请先在主控台加载数据或开始游戏</p>
        </div>
      </div>
    );
  }

  const currentRoundStates = getRoundFarmStates(farmStates, game.currentRound);
  const selectedFarm = farms.find((f) => f.id === selectedFarmId);
  const selectedFarmState = currentRoundStates.find((fs) => fs.farmId === selectedFarmId);

  const handleSuccess = (message: string) => {
    showToast('success', message);
  };

  const handleError = (message: string) => {
    showToast('error', message);
  };

  const isRunning = game.status === 'running';

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {isReplaying && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <AlertBox
            type="info"
            message="回放模式：无法进行交易操作"
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 pt-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6" style={{ fontFamily: 'ZCOOL XiaoWei, serif' }}>
          🌾 农场列表与交易
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold text-gray-700 mb-4">选择农场进行交易</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {farms.map((farm) => {
                const state = currentRoundStates.find((fs) => fs.farmId === farm.id);
                return (
                  <FarmCard
                    key={farm.id}
                    farm={farm}
                    state={state}
                    onSelect={() => setSelectedFarmId(farm.id)}
                    selected={selectedFarmId === farm.id}
                    disabled={!isRunning || isReplaying}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-700 mb-4">交易操作</h2>
            {selectedFarm && selectedFarmState ? (
              <TradeForm
                farm={selectedFarm}
                farmState={selectedFarmState}
                onSuccess={handleSuccess}
                onError={handleError}
              />
            ) : (
              <div className="bg-white border-2 border-gray-200 border-dashed rounded-lg p-8 text-center">
                <p className="text-gray-500">请在左侧选择一个农场</p>
                <p className="text-sm text-gray-400 mt-2">
                  点击农场卡片后可在此进行碳配额买卖
                </p>
              </div>
            )}

            {!isRunning && !isReplaying && (
              <div className="mt-4">
                <AlertBox
                  type="warning"
                  message={
                    game.status === 'paused'
                      ? '游戏已暂停，请先继续游戏'
                      : '游戏未开始，请先在主控台开始游戏'
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
