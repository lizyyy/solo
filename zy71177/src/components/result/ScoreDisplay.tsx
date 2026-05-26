import React from 'react';
import { Trophy, Star } from 'lucide-react';
import { ScoreBreakdown } from '../../types';

interface ScoreDisplayProps {
  scoreBreakdown: ScoreBreakdown;
  success: boolean;
  levelName: string;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  scoreBreakdown,
  success,
  levelName
}) => {
  return (
    <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
      <div className="text-center mb-6">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
          success 
            ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
            : 'bg-gradient-to-br from-red-500 to-rose-600'
        }`}>
          <Trophy size={40} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">
          {success ? '恭喜通关！' : '游戏结束'}
        </h2>
        <p className="text-slate-400">{levelName}</p>
      </div>

      <div className="flex justify-center gap-2 mb-6">
        {[1, 2, 3].map((i) => (
          <Star
            key={i}
            size={36}
            className={`transition-all duration-500 ${
              i <= scoreBreakdown.stars
                ? 'text-yellow-400 fill-yellow-400 scale-110'
                : 'text-slate-600'
            }`}
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>

      <div className="text-center mb-6">
        <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-mono mb-2">
          {scoreBreakdown.finalScore}
        </div>
        <div className="text-sm text-slate-400">最终得分</div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 mb-2">得分明细</h3>
        
        <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
          <span className="text-slate-300">基础分 (达标回合 × 100)</span>
          <span className="font-mono text-green-400">+{scoreBreakdown.baseScore}</span>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
          <span className="text-slate-300">成本扣分</span>
          <span className="font-mono text-red-400">-{scoreBreakdown.costPenalty}</span>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
          <span className="text-slate-300">搅拌不足扣分</span>
          <span className="font-mono text-orange-400">-{scoreBreakdown.stirringPenalty}</span>
        </div>
        
        <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
          <span className="text-slate-300">超量投加扣分</span>
          <span className="font-mono text-red-500">-{scoreBreakdown.overdosePenalty}</span>
        </div>

        <div className="border-t border-slate-700 pt-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold">最终得分</span>
            <span className="font-mono text-xl font-bold text-cyan-400">
              {scoreBreakdown.finalScore}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
