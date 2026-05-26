import { Play, Pause, RotateCcw, FastForward, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GameSpeed } from '../../types/game';

interface GameControlsProps {
  isPaused: boolean;
  gameSpeed: GameSpeed;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onSpeedChange: (speed: GameSpeed) => void;
}

export function GameControls({
  isPaused,
  gameSpeed,
  onPause,
  onResume,
  onRestart,
  onSpeedChange,
}: GameControlsProps) {
  const navigate = useNavigate();
  
  const speeds: GameSpeed[] = [1, 2, 4];

  return (
    <div className="flex items-center gap-2 p-3 bg-gray-800/80 rounded-lg backdrop-blur">
      <button
        onClick={() => navigate('/')}
        className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        title="返回主菜单"
      >
        <Home className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-600" />

      <button
        onClick={isPaused ? onResume : onPause}
        className={`p-2 rounded-lg transition-colors ${
          isPaused
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-yellow-600 hover:bg-yellow-500 text-white'
        }`}
        title={isPaused ? '继续' : '暂停'}
      >
        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
      </button>

      <button
        onClick={onRestart}
        className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        title="重新开始"
      >
        <RotateCcw className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-600" />

      <div className="flex items-center gap-1">
        <FastForward className="w-4 h-4 text-gray-400" />
        {speeds.map((speed) => (
          <button
            key={speed}
            onClick={() => onSpeedChange(speed)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              gameSpeed === speed
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}
