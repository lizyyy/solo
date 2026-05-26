import { useGameStore } from '@/store/gameStore';
import { Play, Pause, RotateCcw, SkipForward, Home } from 'lucide-react';

interface Props {
  onGoToMenu?: () => void;
}

export default function TopBar({ onGoToMenu }: Props) {
  const state = useGameStore();

  const isPlaying = state.phase === 'playing';
  const isPaused = state.phase === 'paused';

  const handleEndTurn = () => {
    if (isPlaying) state.endTurn();
  };

  const handlePauseResume = () => {
    if (isPlaying) state.pauseGame();
    else if (isPaused) state.resumeGame();
  };

  const handleRestart = () => {
    state.restartGame();
  };

  const handleMenu = () => {
    state.goToMenu();
    onGoToMenu?.();
  };

  const progress = state.maxTurns > 0 ? (state.currentTurn / state.maxTurns) * 100 : 0;

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">回合</span>
          <span className="text-2xl font-mono font-bold text-white">
            {state.currentTurn}
          </span>
          <span className="text-slate-500 text-sm">/ {state.maxTurns}</span>
        </div>
        <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              progress > 80 ? 'bg-red-500' : progress > 60 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleEndTurn}
          disabled={!isPlaying}
          className={`px-4 py-2 rounded flex items-center gap-2 font-medium text-sm transition-all ${
            isPlaying
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          <SkipForward size={16} />
          推进回合
        </button>
        <button
          onClick={handlePauseResume}
          disabled={!isPlaying && !isPaused}
          className={`px-3 py-2 rounded flex items-center gap-1 transition-all ${
            isPlaying || isPaused
              ? 'bg-slate-700 hover:bg-slate-600 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isPaused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button
          onClick={handleRestart}
          className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1 transition-all"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={handleMenu}
          className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1 transition-all"
        >
          <Home size={16} />
        </button>
      </div>
    </div>
  );
}
