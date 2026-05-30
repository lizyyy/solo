import React from 'react';
import { useGameStore } from './store/useGameStore';
import LevelSelect from './components/Menu/LevelSelect';
import GameCanvas from './components/Canvas/GameCanvas';
import BlockToolbox from './components/Toolbox/BlockToolbox';
import InfoPanel from './components/InfoPanel/InfoPanel';
import ReportPanel from './components/Report/ReportPanel';

const App: React.FC = () => {
  const { currentView, resetGame } = useGameStore();

  if (currentView === 'menu') {
    return <LevelSelect />;
  }

  return (
    <div className="min-h-screen p-4">
      <header className="max-w-7xl mx-auto mb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={resetGame}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <span>←</span>
            <span>返回关卡选择</span>
          </button>
          <h1 className="text-xl font-bold text-white font-mono">
            🌉 多边形修桥挑战
          </h1>
          <div className="w-32" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-2">
            <div className="h-[calc(100vh-120px)]">
              <BlockToolbox />
            </div>
          </div>

          <div className="col-span-7">
            <div className="flex items-center justify-center h-[calc(100vh-120px)]">
              <GameCanvas />
            </div>
          </div>

          <div className="col-span-3">
            <div className="h-[calc(100vh-120px)]">
              <InfoPanel />
            </div>
          </div>
        </div>
      </main>

      {currentView === 'report' && <ReportPanel />}
    </div>
  );
};

export default App;
