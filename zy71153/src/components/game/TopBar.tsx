import { useGameStore } from '../../store/useGameStore';
import { formatTime } from '../../game/engine';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';

export const TopBar = () => {
  const {
    turn,
    maxTurns,
    elapsedTime,
    isPaused,
    phase,
    weather,
    pauseGame,
    resumeGame,
    endTurn,
    resetGame,
  } = useGameStore();

  const weatherInfo = {
    sunny: { icon: '☀️', text: '晴朗' },
    rainy: { icon: '🌧️', text: '降雨' },
    stormy: { icon: '⛈️', text: '暴风雨' },
  };

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-white">🚑 灾后物资配送</h1>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="bg-slate-700 rounded px-3 py-1">
              <span className="text-slate-400">回合: </span>
              <span className="text-white font-bold">{turn} / {maxTurns}</span>
            </div>
            
            <div className="bg-slate-700 rounded px-3 py-1">
              <span className="text-slate-400">时间: </span>
              <span className="text-white font-bold">{formatTime(elapsedTime)}</span>
            </div>
            
            <div className="bg-slate-700 rounded px-3 py-1">
              <span className="text-slate-400">天气: </span>
              <span className="text-white">
                {weatherInfo[weather].icon} {weatherInfo[weather].text}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {phase === 'executing' && (
            <>
              {isPaused ? (
                <button
                  onClick={resumeGame}
                  className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                >
                  <Play size={16} /> 继续
                </button>
              ) : (
                <button
                  onClick={pauseGame}
                  className="flex items-center gap-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm"
                >
                  <Pause size={16} /> 暂停
                </button>
              )}
              
              <button
                onClick={endTurn}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
              >
                <SkipForward size={16} /> 下一回合
              </button>
            </>
          )}
          
          <button
            onClick={resetGame}
            className="flex items-center gap-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors text-sm"
          >
            <RotateCcw size={16} /> 重开
          </button>
        </div>
      </div>
    </div>
  );
};
