import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useUIStore } from '../store/useUIStore';
import { useGameEngine } from '../hooks/useGameEngine';
import { HallMap } from '../components/game/HallMap';
import { DataPanel } from '../components/game/DataPanel';
import { RoutePlanner } from '../components/game/RoutePlanner';
import { TimeDisplay } from '../components/game/TimeDisplay';
import { AnomalyQueue } from '../components/game/AnomalyQueue';
import { AnomalyModal } from '../components/game/AnomalyModal';
import { AlertTriangle, Home, Flag } from 'lucide-react';

export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { state, openAnomalyModal, finalizeGame } = useGameStore();
  const { notifications } = useUIStore();

  useGameEngine();

  useEffect(() => {
    if (state.isGameOver && state.endTime !== null) {
      navigate('/result');
    }
  }, [state.isGameOver, state.endTime, navigate]);

  const pendingAnomalies = state.anomalies.filter(
    a => a.detectedTime !== null && a.status === 'pending'
  );

  const handleEndGame = () => {
    if (confirm('确定要结束游戏吗？将立即计算最终得分。')) {
      finalizeGame();
    }
  };

  return (
    <div className="min-h-screen bg-night-700 flex flex-col">
      <header className="bg-night-600 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold font-mono text-white">美术馆夜巡</h1>
            {pendingAnomalies.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-alert-red/20 text-alert-red text-xs font-mono animate-pulse">
                <AlertTriangle size={12} />
                {pendingAnomalies.length} 个异常待处理
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="glow-btn px-3 py-1.5 text-xs flex items-center gap-1"
            >
              <Home size={14} />
              主页
            </button>
            <button
              onClick={handleEndGame}
              className="glow-btn-warning px-3 py-1.5 text-xs flex items-center gap-1"
            >
              <Flag size={14} />
              结束游戏
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-gray-700 flex flex-col overflow-hidden">
          <div className="p-3 overflow-y-auto flex-1 scrollbar-thin">
            <DataPanel />
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 flex-1 overflow-hidden">
            <HallMap />
          </div>
        </div>

        <div className="w-80 border-l border-gray-700 flex flex-col overflow-hidden">
          <div className="p-3 space-y-3 overflow-y-auto flex-1 scrollbar-thin">
            <TimeDisplay />
            <RoutePlanner />
            <div className="flex-1 min-h-0">
              <AnomalyQueue onSelectAnomaly={openAnomalyModal} />
            </div>
          </div>
        </div>
      </div>

      <AnomalyModal />

      {notifications.length > 0 && (
        <div className="fixed bottom-4 right-4 space-y-2 z-50">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`px-4 py-2 border text-sm animate-slide-in ${
                notification.type === 'success' ? 'bg-alert-green/20 border-alert-green text-alert-green' :
                notification.type === 'warning' ? 'bg-alert-yellow/20 border-alert-yellow text-alert-yellow' :
                notification.type === 'error' ? 'bg-alert-red/20 border-alert-red text-alert-red' :
                'bg-night-500 border-gray-600 text-gray-300'
              }`}
            >
              {notification.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
