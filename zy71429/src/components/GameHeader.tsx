import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { cn } from '@/lib/utils';
import {
  RotateCcw,
  Upload,
  Download,
  History,
  Trophy,
  Clock,
  Pause,
  Play,
} from 'lucide-react';
import ImportExportPanel from './ImportExportPanel';
import ReplayPlayer from './ReplayPlayer';

interface GameHeaderProps {
  onShowImportExport?: () => void;
  onShowReplay?: () => void;
}

export default function GameHeader({ onShowImportExport, onShowReplay }: GameHeaderProps) {
  const [showImportExport, setShowImportExport] = useState(false);
  const [showReplay, setShowReplay] = useState(false);

  const {
    gameId,
    score,
    isGameOver,
    isPaused,
    currentTime,
    startTime,
    endTime,
    resetGame,
    togglePause,
  } = useGameStore();

  const getGameStatus = () => {
    if (isGameOver) {
      return { label: '已结束', color: 'text-alert-missed', dotColor: 'bg-alert-missed' };
    }
    if (isPaused) {
      return { label: '已暂停', color: 'text-alert-fuel', dotColor: 'bg-alert-fuel' };
    }
    return { label: '进行中', color: 'text-alert-success', dotColor: 'bg-alert-success' };
  };

  const formatGameTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateProgress = () => {
    const total = endTime.getTime() - startTime.getTime();
    const elapsed = currentTime.getTime() - startTime.getTime();
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  const status = getGameStatus();
  const progress = calculateProgress();

  const handleReset = () => {
    if (window.confirm('确定要重置游戏吗？所有进度将丢失。')) {
      resetGame();
    }
  };

  const handleImportExport = () => {
    if (onShowImportExport) {
      onShowImportExport();
    } else {
      setShowImportExport(true);
    }
  };

  const handleReplay = () => {
    if (onShowReplay) {
      onShowReplay();
    } else {
      setShowReplay(true);
    }
  };

  return (
    <>
      <header className="bg-ocean-800/80 backdrop-blur-md border-b border-ocean-700/50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-ocean-500 to-ocean-700 flex items-center justify-center">
                  <span className="text-xl font-display text-white">港</span>
                </div>
                <div>
                  <h1 className="font-display text-xl text-ocean-100">港口风浪靠泊赛</h1>
                  <div className="flex items-center gap-2 text-xs font-mono text-ocean-500">
                    <span>ID: {gameId}</span>
                  </div>
                </div>
              </div>

              <div className="h-8 w-px bg-ocean-700/50" />

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-alert-fuel" />
                  <div>
                    <div className="text-xs text-ocean-500 font-mono">得分</div>
                    <div className="font-display text-lg text-ocean-100 font-mono">{score}</div>
                  </div>
                </div>

                <div className="h-8 w-px bg-ocean-700/50" />

                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-ocean-400" />
                  <div>
                    <div className="text-xs text-ocean-500 font-mono">当前时间</div>
                    <div className="font-mono text-sm text-ocean-200">
                      {formatGameTime(currentTime)}
                    </div>
                  </div>
                </div>

                <div className="h-8 w-px bg-ocean-700/50" />

                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', status.dotColor)} />
                  <div>
                    <div className="text-xs text-ocean-500 font-mono">游戏状态</div>
                    <div className={cn('font-mono text-sm', status.color)}>
                      {status.label}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isGameOver && (
                <button
                  onClick={togglePause}
                  className="btn-secondary flex items-center gap-2"
                >
                  {isPaused ? (
                    <>
                      <Play className="w-4 h-4" />
                      继续
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      暂停
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleReset}
                className="btn-secondary flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                重置游戏
              </button>

              <button
                onClick={handleImportExport}
                className="btn-secondary flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                导入数据
              </button>

              <button
                onClick={handleImportExport}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                导出结果
              </button>

              <button
                onClick={handleReplay}
                className="btn-secondary flex items-center gap-2"
                disabled={!isGameOver}
              >
                <History className="w-4 h-4" />
                复盘回放
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs font-mono text-ocean-500 mb-1">
              <span>{formatGameTime(startTime)}</span>
              <span>游戏进度 {progress.toFixed(1)}%</span>
              <span>{formatGameTime(endTime)}</span>
            </div>
            <div className="h-1.5 bg-ocean-900/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-ocean-600 to-ocean-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <ImportExportPanel
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
      />
      
      <ReplayPlayer
        isOpen={showReplay}
        onClose={() => setShowReplay(false)}
      />
    </>
  );
}
