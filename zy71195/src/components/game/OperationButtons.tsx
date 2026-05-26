import { Pause, Play, RotateCcw, Check, X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { Button } from '../ui/Button';

export function OperationButtons() {
  const { gameState, passVehicle, interceptVehicle, pauseGame, resumeGame, restartGame } = useGameStore();
  const { status, currentVehicle } = gameState;

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';

  return (
    <div className="bg-slate-900 border-2 border-slate-700 p-4">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button
          variant="success"
          size="xl"
          onClick={passVehicle}
          disabled={!isPlaying || !currentVehicle}
          className="min-w-40"
        >
          <Check className="w-6 h-6 mr-2" />
          放行
          <span className="ml-2 text-xs opacity-70">空格/Enter</span>
        </Button>

        <Button
          variant="danger"
          size="xl"
          onClick={interceptVehicle}
          disabled={!isPlaying || !currentVehicle}
          className="min-w-40"
        >
          <X className="w-6 h-6 mr-2" />
          拦截
          <span className="ml-2 text-xs opacity-70">Backspace</span>
        </Button>

        <div className="flex gap-2 ml-4">
          <Button
            variant="secondary"
            size="lg"
            onClick={isPaused ? resumeGame : pauseGame}
            disabled={!isPlaying && !isPaused}
          >
            {isPaused ? (
              <>
                <Play className="w-5 h-5 mr-2" />
                继续
              </>
            ) : (
              <>
                <Pause className="w-5 h-5 mr-2" />
                暂停
              </>
            )}
            <span className="ml-2 text-xs opacity-70">P/Esc</span>
          </Button>

          <Button
            variant="warning"
            size="lg"
            onClick={restartGame}
            disabled={!isPlaying && !isPaused}
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            重开
            <span className="ml-2 text-xs opacity-70">Ctrl+R</span>
          </Button>
        </div>
      </div>

      <div className="mt-4 text-center text-xs text-slate-500">
        <p>
          快捷键：<kbd className="px-1 py-0.5 bg-slate-800 rounded">空格</kbd> 放行 | 
          <kbd className="px-1 py-0.5 bg-slate-800 rounded mx-1">Backspace</kbd> 拦截 | 
          <kbd className="px-1 py-0.5 bg-slate-800 rounded mx-1">P</kbd> 暂停 | 
          <kbd className="px-1 py-0.5 bg-slate-800 rounded mx-1">Esc</kbd> 暂停/继续
        </p>
      </div>
    </div>
  );
}
