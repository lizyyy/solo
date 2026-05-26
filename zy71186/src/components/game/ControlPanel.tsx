import { Play, Pause, RotateCcw, Home, Gauge } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { GAME_SPEED_OPTIONS } from '../../engine/constants';
import { useNavigate } from 'react-router-dom';

export function ControlPanel() {
  const {
    gameStatus,
    gameSpeed,
    currentState,
    pauseGame,
    resumeGame,
    restartGame,
    setGateOpening,
    setGameSpeed,
    resetAll,
  } = useGameStore();

  const navigate = useNavigate();
  const isPlaying = gameStatus === 'playing';
  const isPaused = gameStatus === 'paused';
  const isReplaying = gameStatus === 'replaying';
  const isEnded = gameStatus === 'ended';
  const canControl = isPlaying || isPaused;

  const handleGateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGateOpening(Number(e.target.value));
  };

  const handleSpeedChange = (speed: number) => {
    setGameSpeed(speed);
  };

  const handleRestart = () => {
    restartGame();
  };

  const handleBack = () => {
    resetAll();
    navigate('/');
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-bold text-white mb-3">控制面板</h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-300 text-sm">闸门开度</span>
          <span className="text-blue-400 font-mono font-bold">
            {currentState?.gateOpening.toFixed(0) || 0}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={currentState?.gateOpening || 0}
          onChange={handleGateChange}
          disabled={!canControl}
          className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-blue-500
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-lg
            disabled:opacity-50
            disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>全关</span>
          <span>全开</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-slate-300 text-sm">
          <Gauge size={16} />
          <span>游戏速度</span>
        </div>
        <div className="flex gap-2">
          {GAME_SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              onClick={() => handleSpeedChange(speed)}
              disabled={!canControl}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all
                ${gameSpeed === speed
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        {isPlaying && (
          <button
            onClick={pauseGame}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-all"
          >
            <Pause size={18} />
            暂停
          </button>
        )}
        {isPaused && (
          <button
            onClick={resumeGame}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all"
          >
            <Play size={18} />
            继续
          </button>
        )}
        {(isPlaying || isPaused || isEnded) && (
          <button
            onClick={handleRestart}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium transition-all"
          >
            <RotateCcw size={18} />
            重开
          </button>
        )}
      </div>

      {isReplaying && (
        <div className="text-center py-2 text-amber-400 text-sm">
          正在回放模式
        </div>
      )}

      <button
        onClick={handleBack}
        className="w-full flex items-center justify-center gap-2 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-all"
      >
        <Home size={16} />
        返回选关
      </button>
    </div>
  );
}
