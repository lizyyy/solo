import { Clock, Cloud, Zap, Trophy } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

export function TopBar() {
  const { turn, maxTurns, score, weather, nextWeather, currentLevel, difficulty } = useGameStore();

  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-500',
    normal: 'bg-yellow-500',
    hard: 'bg-red-500'
  };

  const difficultyNames: Record<string, string> = {
    easy: '简单',
    normal: '普通',
    hard: '困难'
  };

  return (
    <div className="absolute top-0 left-0 right-0 h-14 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <span className="text-white font-bold text-lg">电网抢修</span>
          <span className="text-slate-400 text-sm">{currentLevel.name}</span>
        </div>
        
        <div className={`px-2 py-1 rounded text-xs text-white ${difficultyColors[difficulty]}`}>
          {difficultyNames[difficulty]}
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-white font-mono">
            回合 <span className="text-yellow-400">{turn}</span> / {maxTurns}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Cloud className="w-4 h-4 text-blue-400" />
            <span className="text-white text-sm">
              {weather.icon} {weather.description}
            </span>
          </div>
          <span className="text-slate-500 text-sm">→</span>
          <span className="text-slate-400 text-sm">
            {nextWeather.icon} {nextWeather.description}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-white font-mono text-lg font-bold">
            {score.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
