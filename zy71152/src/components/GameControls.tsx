import { useGameStore } from '../store/gameStore';
import { GAME_STATUSES, TRAIN_STATUSES } from '../types/game';
import { Play, Pause, RotateCcw, Home, FastForward, ChevronRight, ChevronLeft } from 'lucide-react';

interface GameControlsProps {
  onBackToMenu: () => void;
}

export default function GameControls({ onBackToMenu }: GameControlsProps) {
  const {
    status,
    score,
    time,
    speedMultiplier,
    trains,
    level,
    events,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    setSpeedMultiplier,
    saveReplay
  } = useGameStore();

  const formatTime = (t: number) => {
    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const completedTrains = trains.filter(t => t.status === TRAIN_STATUSES.COMPLETED).length;
  const delayedTrains = trains.filter(t => t.delay > 50 && t.status !== TRAIN_STATUSES.COMPLETED).length;

  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">
          {level?.name}
        </h2>
        <button
          onClick={onBackToMenu}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          title="返回菜单"
        >
          <Home className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">分数</div>
          <div className="text-2xl font-bold text-emerald-400">{score}</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">时间</div>
          <div className="text-2xl font-bold text-slate-100">{formatTime(time)}</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">完成</div>
          <div className="text-xl font-bold text-blue-400">
            {completedTrains}/{trains.length}
          </div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">晚点</div>
          <div className={`text-xl font-bold ${delayedTrains > 0 ? 'text-red-400' : 'text-slate-100'}`}>
            {delayedTrains}
          </div>
        </div>
      </div>

      <div className="bg-slate-700/50 rounded-lg p-3">
        <div className="text-xs text-slate-400 mb-2">速度控制</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSpeedMultiplier(Math.max(0.5, speedMultiplier - 0.5))}
            className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center font-mono text-lg">
            {speedMultiplier}x
          </div>
          <button
            onClick={() => setSpeedMultiplier(Math.min(3, speedMultiplier + 0.5))}
            className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {status === GAME_STATUSES.READY && (
          <button
            onClick={startGame}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-colors"
          >
            <Play className="w-5 h-5" />
            开始
          </button>
        )}
        {status === GAME_STATUSES.RUNNING && (
          <button
            onClick={pauseGame}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-semibold transition-colors"
          >
            <Pause className="w-5 h-5" />
            暂停
          </button>
        )}
        {status === GAME_STATUSES.PAUSED && (
          <button
            onClick={resumeGame}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-colors"
          >
            <Play className="w-5 h-5" />
            继续
          </button>
        )}
        {(status === GAME_STATUSES.WON || status === GAME_STATUSES.LOST) && (
          <>
            <button
              onClick={saveReplay}
              className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors px-4"
            >
              <FastForward className="w-5 h-5" />
              保存
            </button>
          </>
        )}
        <button
          onClick={restartGame}
          className="flex items-center justify-center gap-2 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold transition-colors px-4"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-slate-700/50 rounded-lg p-3 max-h-40 overflow-y-auto">
        <div className="text-xs text-slate-400 mb-2">事件日志</div>
        <div className="space-y-1">
          {events.slice(-8).reverse().map((event, i) => (
            <div key={i} className="text-xs text-slate-300 flex gap-2">
              <span className="text-slate-500 font-mono">[{formatTime(event.time)}]</span>
              <span>{event.message}</span>
            </div>
          ))}
          {events.length === 0 && (
            <div className="text-xs text-slate-500">暂无事件</div>
          )}
        </div>
      </div>

      <div className="bg-slate-700/50 rounded-lg p-3">
        <div className="text-xs text-slate-400 mb-2">列车状态</div>
        <div className="space-y-2">
          {trains.map(train => (
            <div key={train.id} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: train.color }}
              />
              <span className="text-sm font-mono text-slate-200 w-12">{train.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                train.status === TRAIN_STATUSES.WAITING ? 'bg-slate-600 text-slate-300' :
                train.status === TRAIN_STATUSES.RUNNING ? 'bg-emerald-600/30 text-emerald-400' :
                train.status === TRAIN_STATUSES.STOPPED ? 'bg-amber-600/30 text-amber-400' :
                'bg-blue-600/30 text-blue-400'
              }`}>
                {train.status === TRAIN_STATUSES.WAITING ? '待发' :
                 train.status === TRAIN_STATUSES.RUNNING ? '运行' :
                 train.status === TRAIN_STATUSES.STOPPED ? '停车' : '完成'}
              </span>
              {train.delay > 0 && (
                <span className={`text-xs ${train.delay > 100 ? 'text-red-400' : 'text-amber-400'}`}>
                  +{Math.floor(train.delay)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
