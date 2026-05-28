import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pause, Play, RotateCcw, Home, ChevronRight, AlertCircle } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { HoldingTable } from '../components/game/HoldingTable';
import { TradePanel } from '../components/game/TradePanel';
import { Dashboard } from '../components/game/Dashboard';
import { WarningList } from '../components/game/WarningList';
import { EventModal } from '../components/game/EventModal';

export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    round,
    maxRounds,
    cash,
    totalAssets,
    holdings,
    indexComponents,
    trackingError,
    currentEvent,
    operationLogs,
    warnings,
    gameStatus,
    buyStock,
    sellStock,
    handleEvent,
    nextRound,
    pauseGame,
    resumeGame,
    resetGame,
    endGame,
  } = useGameStore();

  const [selectedStock, setSelectedStock] = useState<{
    code: string;
    name: string;
    price: number;
    isSuspended: boolean;
    currentHolding: number;
  } | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);

  useEffect(() => {
    if (gameStatus === 'idle') {
      navigate('/');
    }
  }, [gameStatus, navigate]);

  useEffect(() => {
    if (currentEvent && gameStatus === 'playing') {
      setShowEventModal(true);
    }
  }, [currentEvent, gameStatus]);

  const handleSelectStock = (
    code: string,
    name: string,
    price: number,
    isSuspended: boolean,
    currentHolding: number
  ) => {
    setSelectedStock({ code, name, price, isSuspended, currentHolding });
  };

  const handleDismissWarning = (id: string) => {
  };

  const handleNextRound = () => {
    if (round >= maxRounds) {
      endGame();
      navigate('/report');
    } else {
      nextRound();
    }
  };

  const handleGoHome = () => {
    resetGame();
    navigate('/');
  };

  if (gameStatus === 'idle') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-slate-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">📊 指数基金复制挑战</h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-700 rounded-full">
              <span className="text-sm">回合</span>
              <span className="font-bold text-lg">{round}</span>
              <span className="text-slate-400">/ {maxRounds}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {currentEvent && (
              <button
                onClick={() => setShowEventModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg font-medium animate-pulse"
              >
                <AlertCircle size={18} />
                待处理事件
              </button>
            )}
            
            <button
              onClick={gameStatus === 'paused' ? resumeGame : pauseGame}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title={gameStatus === 'paused' ? '继续' : '暂停'}
            >
              {gameStatus === 'paused' ? <Play size={20} /> : <Pause size={20} />}
            </button>
            
            <button
              onClick={handleGoHome}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="返回首页"
            >
              <Home size={20} />
            </button>
            
            <button
              onClick={resetGame}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="重新开始"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {gameStatus === 'paused' && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
            <span className="text-yellow-700 font-medium">⏸️ 游戏已暂停</span>
            <button
              onClick={resumeGame}
              className="ml-4 px-4 py-1 bg-yellow-500 text-white rounded font-medium hover:bg-yellow-600 transition-colors"
            >
              继续游戏
            </button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-6">
            <div className="h-[600px]">
              <HoldingTable
                holdings={holdings}
                indexComponents={indexComponents}
                totalAssets={totalAssets}
                onSelectStock={handleSelectStock}
              />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-3">
            <div className="space-y-6">
              <Dashboard
                cash={cash}
                totalAssets={totalAssets}
                trackingError={trackingError}
                round={round}
                maxRounds={maxRounds}
              />
              
              <TradePanel
                cash={cash}
                selectedStock={selectedStock}
                onBuy={buyStock}
                onSell={sellStock}
              />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-3">
            <div className="space-y-6">
              <WarningList
                warnings={warnings}
                onDismiss={handleDismissWarning}
              />
              
              <div className="bg-white rounded-lg shadow-md p-4">
                <button
                  onClick={handleNextRound}
                  disabled={gameStatus !== 'playing'}
                  className="w-full py-4 bg-slate-800 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {round >= maxRounds ? '查看复盘报告' : '下一回合'}
                  <ChevronRight size={20} />
                </button>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  完成当前操作后进入下一回合
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showEventModal && currentEvent && (
        <EventModal
          event={currentEvent}
          onHandle={() => {
            handleEvent();
            setShowEventModal(false);
          }}
          onClose={() => setShowEventModal(false)}
        />
      )}
    </div>
  );
};
