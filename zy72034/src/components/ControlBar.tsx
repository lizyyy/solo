import React, { useState } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Flag, AlertCircle } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { cn } from '../lib/utils';

interface ControlBarProps {
  onPause?: () => void;
  onResume?: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({ onPause, onResume }) => {
  const {
    game,
    currentRoundState,
    isReplaying,
    pauseGame,
    resumeGame,
    restartFromRound,
    settleRound,
    nextRound,
  } = useGameStore();

  const [showRestartModal, setShowRestartModal] = useState(false);
  const [restartRound, setRestartRound] = useState(1);
  const [restartReason, setRestartReason] = useState('');
  const [settleReason, setSettleReason] = useState('');
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [showPauseModal, setShowPauseModal] = useState(false);

  if (!game || isReplaying) return null;

  const handlePause = () => {
    if (game.status === 'running') {
      setShowPauseModal(true);
    } else if (game.status === 'paused') {
      resumeGame();
      onResume?.();
    }
  };

  const confirmPause = () => {
    pauseGame(pauseReason || '课堂临时暂停');
    setShowPauseModal(false);
    setPauseReason('');
    onPause?.();
  };

  const handleRestart = () => {
    if (restartRound > 0 && restartReason) {
      restartFromRound(restartRound, restartReason);
      setShowRestartModal(false);
      setRestartReason('');
    }
  };

  const handleSettle = () => {
    if (settleReason) {
      settleRound(settleReason);
      setShowSettleModal(false);
      setSettleReason('');
    }
  };

  const isRunning = game.status === 'running';
  const isPaused = game.status === 'paused';
  const isEnded = game.status === 'ended';

  const statusColor = isRunning
    ? 'bg-green-500'
    : isPaused
    ? 'bg-yellow-500'
    : isEnded
    ? 'bg-gray-500'
    : 'bg-gray-300';

  const statusText = isRunning
    ? '进行中'
    : isPaused
    ? '已暂停'
    : isEnded
    ? '已结束'
    : '未开始';

  return (
    <>
      <div className="bg-white border-b-2 border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: 'ZCOOL XiaoWei, serif' }}>
                  🌱 碳交易农场经营
                </h1>
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded">
                  <div className={cn('w-3 h-3 rounded-full animate-pulse', statusColor)} />
                  <span className="text-sm font-medium text-gray-600">{statusText}</span>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-300" />

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-700">第 {game.currentRound} 回合</span>
                <span className="text-gray-500">/ {game.totalRounds}</span>
              </div>

              {currentRoundState && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded border border-blue-200">
                  <span className="text-sm text-gray-600">碳价:</span>
                  <span className="text-lg font-bold text-blue-700">¥{currentRoundState.carbonPrice}/吨</span>
                  {currentRoundState.priceFluctuation !== 0 && (
                    <span
                      className={cn(
                        'text-sm font-medium',
                        currentRoundState.priceFluctuation > 0 ? 'text-red-500' : 'text-green-500'
                      )}
                    >
                      {currentRoundState.priceFluctuation > 0 ? '+' : ''}
                      {currentRoundState.priceFluctuation}%
                    </span>
                  )}
                </div>
              )}

              {game.restartFromRound && (
                <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 rounded border border-orange-200">
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-orange-700">
                    从第{game.restartFromRound}回合返工
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isEnded && (
                <>
                  <button
                    onClick={handlePause}
                    disabled={game.status === 'idle'}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 border rounded font-medium transition-all',
                      isRunning
                        ? 'bg-yellow-50 border-yellow-500 text-yellow-700 hover:bg-yellow-100'
                        : isPaused
                        ? 'bg-green-50 border-green-500 text-green-700 hover:bg-green-100'
                        : 'bg-gray-50 border-gray-300 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isRunning ? '暂停' : isPaused ? '继续' : '暂停'}
                  </button>

                  <button
                    onClick={() => setShowSettleModal(true)}
                    disabled={!isRunning}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 border rounded font-medium transition-all',
                      isRunning
                        ? 'bg-blue-50 border-blue-500 text-blue-700 hover:bg-blue-100'
                        : 'bg-gray-50 border-gray-300 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <Flag className="w-4 h-4" />
                    结算
                  </button>

                  <button
                    onClick={nextRound}
                    disabled={!isRunning}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 border rounded font-medium transition-all',
                      isRunning
                        ? 'bg-green-50 border-green-500 text-green-700 hover:bg-green-100'
                        : 'bg-gray-50 border-gray-300 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    <SkipForward className="w-4 h-4" />
                    下一回合
                  </button>

                  <button
                    onClick={() => setShowRestartModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-500 text-gray-700 rounded font-medium hover:bg-gray-100 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    重开
                  </button>
                </>
              )}

              {isEnded && (
                <div className="px-4 py-2 bg-green-100 border border-green-500 text-green-700 rounded font-medium">
                  游戏已结束
                </div>
              )}
            </div>
          </div>

          {currentRoundState?.settlementReason && (
            <div className="mt-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded">
              <span className="font-medium">结算原因:</span> {currentRoundState.settlementReason}
            </div>
          )}
        </div>
      </div>

      {showPauseModal && (
        <Modal title="暂停游戏" onClose={() => setShowPauseModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                暂停原因
              </label>
              <textarea
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="例如：课堂突发情况需要临时处理"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPauseModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={confirmPause}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                确认暂停
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showSettleModal && (
        <Modal title="结算当前回合" onClose={() => setShowSettleModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                结算原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={settleReason}
                onChange={(e) => setSettleReason(e.target.value)}
                placeholder="请输入结算原因，例如：正常回合结束"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSettleModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSettle}
                disabled={!settleReason.trim()}
                className={cn(
                  'px-4 py-2 rounded',
                  settleReason.trim()
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                确认结算
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showRestartModal && (
        <Modal title="选择重开回合" onClose={() => setShowRestartModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                从第几回合开始重开?
              </label>
              <select
                value={restartRound}
                onChange={(e) => setRestartRound(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Array.from({ length: game.currentRound }, (_, i) => i + 1).map((r) => (
                  <option key={r} value={r}>
                    第 {r} 回合
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                返工原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={restartReason}
                onChange={(e) => setRestartReason(e.target.value)}
                placeholder="请输入返工原因，例如：之前的交易记录有误"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRestartModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleRestart}
                disabled={!restartReason.trim()}
                className={cn(
                  'px-4 py-2 rounded',
                  restartReason.trim()
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                确认重开
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);
