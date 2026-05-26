import React from 'react';
import { Play, RotateCcw, Home, Download } from 'lucide-react';
import { useGameStore } from '../game/state';

export const PauseMenu: React.FC = () => {
  const { status, resumeGame, restartGame, goToMenu, exportReport } = useGameStore();

  if (status !== 'paused') return null;

  const handleExport = () => {
    const report = exportReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="game-card max-w-sm w-full p-6">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">⏸️ 游戏暂停</h2>

        <div className="space-y-3">
          <button
            onClick={resumeGame}
            className="w-full game-btn-primary flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            继续游戏
          </button>

          <button
            onClick={restartGame}
            className="w-full game-btn-secondary flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            重新开始
          </button>

          <button
            onClick={handleExport}
            className="w-full game-btn-secondary flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            导出报告
          </button>

          <button
            onClick={goToMenu}
            className="w-full game-btn-secondary flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
};
