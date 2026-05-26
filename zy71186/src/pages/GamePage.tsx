import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplets } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useGameLoop } from '../hooks/useGameLoop';
import { ReservoirCanvas } from '../components/game/ReservoirCanvas';
import { ControlPanel } from '../components/game/ControlPanel';
import { DataPanel } from '../components/game/DataPanel';
import { CurveChart } from '../components/game/CurveChart';

export function GamePage() {
  const navigate = useNavigate();
  const { gameStatus, currentLevel, currentState } = useGameStore();
  useGameLoop();

  useEffect(() => {
    if (gameStatus === 'ended') {
      navigate('/result');
    }
  }, [gameStatus, navigate]);

  useEffect(() => {
    if (!currentLevel && gameStatus === 'idle') {
      navigate('/');
    }
  }, [currentLevel, gameStatus, navigate]);

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Droplets className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold text-white">水库调度闸门游戏</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm">{currentLevel?.name}</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              gameStatus === 'playing' ? 'bg-green-600 text-white' :
              gameStatus === 'paused' ? 'bg-amber-600 text-white' :
              'bg-slate-600 text-slate-300'
            }`}>
              {gameStatus === 'playing' ? '运行中' :
               gameStatus === 'paused' ? '已暂停' :
               gameStatus === 'ended' ? '已结束' : gameStatus}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800 rounded-xl p-4">
              <h2 className="text-lg font-bold text-white mb-4">水库示意图</h2>
              <div className="flex justify-center">
                <ReservoirCanvas
                  state={currentState}
                  level={currentLevel}
                  width={700}
                  height={380}
                />
              </div>
            </div>

            <CurveChart />
          </div>

          <div className="space-y-6">
            <DataPanel />
            <ControlPanel />
          </div>
        </div>
      </main>

      {gameStatus === 'paused' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
          <div className="bg-slate-800 rounded-xl p-8 text-center pointer-events-auto">
            <h2 className="text-2xl font-bold text-white mb-2">游戏已暂停</h2>
            <p className="text-slate-400">点击"继续"按钮恢复游戏</p>
          </div>
        </div>
      )}
    </div>
  );
}
