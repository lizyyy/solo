import { useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { ControlPanel } from './components/ControlPanel';
import { StatusPanel } from './components/StatusPanel';
import { FacilityPanel } from './components/FacilityPanel';
import { Timeline } from './components/Timeline';
import { ReportModal } from './components/ReportModal';
import { useGameStore } from './store/useGameStore';

function App() {
  const { state, nextTurn, initGame } = useGameStore();

  useEffect(() => {
    initGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.isPaused || state.isGameOver || state.isReplayMode) return;

    const interval = setInterval(() => {
      nextTurn();
    }, 3000 / state.speed);

    return () => clearInterval(interval);
  }, [state.isPaused, state.isGameOver, state.speed, state.isReplayMode, nextTurn]);

  return (
    <div className="w-full h-screen bg-gray-950 relative overflow-hidden">
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <h1 className="text-2xl font-bold text-white drop-shadow-lg flex items-center gap-2">
          <span className="text-3xl">🌧️</span>
          城市排水防涝模拟器
          <span className="text-3xl">💧</span>
        </h1>
      </div>

      <GameCanvas />

      <FacilityPanel />
      <StatusPanel />
      <ControlPanel />
      <Timeline />
      <ReportModal />

      <div className="absolute bottom-28 left-4 z-10 text-xs text-gray-500 max-w-xs">
        <p>🖱️ 拖拽旋转视角 | 滚轮缩放 | 点击网格查看详情</p>
        <p className="mt-1">🔧 清理雨水口堵塞 | ⚡ 调节泵站功率</p>
      </div>
    </div>
  );
}

export default App;
