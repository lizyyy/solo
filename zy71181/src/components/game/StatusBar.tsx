import { useGameStore } from '../../store/useGameStore';
import { WEATHER_NAMES } from '../../game/data/constants';

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function StatusBar() {
  const { gameState, pauseGame } = useGameStore();
  const timeRemaining = Math.max(0, gameState.timeLimit - gameState.timeElapsed);
  const isUrgent = timeRemaining < 60;

  const weatherIcons: Record<string, string> = {
    clear: '☀️',
    light_snow: '🌨️',
    heavy_snow: '❄️',
    blizzard: '🌪️',
  };

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">时间</span>
          <span className={`font-mono text-xl font-bold ${isUrgent ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {formatTime(timeRemaining)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">得分</span>
          <span className="font-mono text-xl font-bold text-yellow-400">
            {gameState.score}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">天气</span>
          <span className="text-2xl">{weatherIcons[gameState.weather]}</span>
          <span className="text-sm">{WEATHER_NAMES[gameState.weather]}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>
              {gameState.patrollers.filter(p => p.status === 'idle').length} 待命
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span>
              {gameState.patrollers.filter(p => p.status === 'dispatched').length} 执行中
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span>
              {gameState.victims.filter(v => !v.isRescued).length} 待救援
            </span>
          </div>
        </div>

        <button
          onClick={pauseGame}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-2"
        >
          <span>⏸️</span>
          暂停
        </button>
      </div>
    </div>
  );
}
