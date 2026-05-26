import { Star, Lock, Play, Trophy } from 'lucide-react';
import type { LevelConfig } from '../../types';

interface LevelCardProps {
  level: LevelConfig;
  highScore: number;
  onSelect: (levelId: string) => void;
  isLocked?: boolean;
}

export function LevelCard({ level, highScore, onSelect, isLocked = false }: LevelCardProps) {
  const difficultyColors = {
    easy: 'bg-green-600',
    medium: 'bg-industrial-yellow',
    hard: 'bg-industrial-red'
  };

  const difficultyText = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs > 0 ? secs + '秒' : ''}`;
  };

  const getStars = (score: number, target: number): number => {
    if (score >= target * 1.2) return 3;
    if (score >= target) return 2;
    if (score >= target * 0.5) return 1;
    return 0;
  };

  const stars = getStars(highScore, level.targetScore);

  return (
    <div
      className={`relative bg-slate-800 rounded-xl p-6 border transition-all duration-200 ${
        isLocked 
          ? 'border-slate-700 opacity-50 cursor-not-allowed' 
          : 'border-slate-700 hover:border-industrial-blue hover:glow-blue cursor-pointer'
      }`}
      onClick={() => !isLocked && onSelect(level.id)}
    >
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 rounded-xl">
          <Lock className="w-12 h-12 text-slate-500" />
        </div>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{level.name}</h3>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded ${difficultyColors[level.difficulty]}`}>
              {difficultyText[level.difficulty]}
            </span>
            <span className="text-xs text-slate-400">
              {formatTime(level.timeLimit)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((i) => (
            <Star
              key={i}
              className={`w-5 h-5 ${
                i <= stars ? 'text-industrial-yellow fill-industrial-yellow' : 'text-slate-600'
              }`}
            />
          ))}
        </div>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">巡检点数量</span>
          <span className="text-white">{level.inspectionPoints.length} 个</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">异常事件</span>
          <span className="text-white">{level.possibleAnomalies.length} 个</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">目标得分</span>
          <span className="text-industrial-yellow font-mono">{level.targetScore} 分</span>
        </div>
      </div>
      
      {highScore > 0 && (
        <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-industrial-yellow" />
            <span className="text-sm text-slate-400">最高得分</span>
          </div>
          <span className="font-mono text-lg text-industrial-yellow">{highScore}</span>
        </div>
      )}
      
      {!isLocked && (
        <div className="mt-4 flex items-center justify-center gap-2 text-industrial-blue">
          <Play className="w-5 h-5" />
          <span className="font-medium">开始挑战</span>
        </div>
      )}
    </div>
  );
}
