import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import GameMap from '@/components/GameMap';
import ControlPanel from '@/components/ControlPanel';
import StatusPanel from '@/components/StatusPanel';
import FaultList from '@/components/FaultList';
import GameOver from '@/components/GameOver';
import StartMenu from '@/components/StartMenu';

export default function Home() {
  const navigate = useNavigate();
  const { status, tick, isPaused } = useGameStore();
  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (status !== 'playing') return;

    const gameLoop = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      if (!isPaused) {
        tick(deltaTime);
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
    };
  }, [status, isPaused, tick]);

  if (status === 'menu') {
    return <StartMenu onShowHistory={() => navigate('/history')} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto p-4">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-amber-400">城市路灯检修</span>
            <span className="text-sm text-slate-500 font-normal">夜间调度模拟器</span>
          </h1>
          <ControlPanel />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <GameMap />
            <div className="mt-4">
              <FaultList />
            </div>
          </div>

          <div className="space-y-4">
            <StatusPanel />

            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <h3 className="text-sm font-medium text-slate-400 mb-3">操作提示</h3>
              <div className="space-y-2 text-xs text-slate-500">
                <p>1. 点击维修车选中（绿色三角）</p>
                <p>2. 点击故障路灯派遣维修</p>
                <p>3. 注意备件数量和时间限制</p>
                <p>4. 高优先级路灯超时扣分更多</p>
              </div>
            </div>

            <button
              onClick={() => navigate('/history')}
              className="w-full py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
            >
              历史记录
            </button>
          </div>
        </div>
      </div>

      {status === 'ended' && <GameOver />}
    </div>
  );
}
