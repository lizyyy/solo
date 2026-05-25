import { Award, TrendingUp, Package, AlertTriangle } from 'lucide-react';
import type { Violation } from '../types/game';

interface ScorePanelProps {
  score: number;
  violations: Violation[];
  spaceUtilization: number;
  totalWeight: number;
  maxWeight: number;
}

export const ScorePanel = ({ score, violations, spaceUtilization, totalWeight, maxWeight }: ScorePanelProps) => {
  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-green-600';
    if (s >= 80) return 'text-blue-600';
    if (s >= 70) return 'text-yellow-600';
    if (s >= 60) return 'text-orange-600';
    return 'text-red-600';
  };
  
  const getScoreBgColor = (s: number) => {
    if (s >= 90) return 'bg-green-100';
    if (s >= 80) return 'bg-blue-100';
    if (s >= 70) return 'bg-yellow-100';
    if (s >= 60) return 'bg-orange-100';
    return 'bg-red-100';
  };
  
  const weightPercentage = (totalWeight / maxWeight) * 100;
  const isOverweight = weightPercentage > 100;
  
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="text-blue-500" size={24} />
          <span className="font-semibold text-gray-700">当前得分</span>
        </div>
        <div className={`${getScoreBgColor(score)} px-4 py-2 rounded-lg`}>
          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="flex items-center gap-1 text-gray-600">
              <TrendingUp size={14} /> 空间利用率
            </span>
            <span className="font-medium">{(spaceUtilization * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${spaceUtilization >= 0.7 ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{ width: `${Math.min(100, spaceUtilization * 100)}%` }}
            />
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="flex items-center gap-1 text-gray-600">
              <Package size={14} /> 总重量
            </span>
            <span className={`font-medium ${isOverweight ? 'text-red-600' : ''}`}>
              {totalWeight.toFixed(1)} / {maxWeight} kg
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${isOverweight ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, weightPercentage)}%` }}
            />
          </div>
        </div>
      </div>
      
      {violations.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <AlertTriangle size={16} />
            <span className="font-medium text-sm">违规记录 ({violations.length})</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {violations.map((v, i) => (
              <div
                key={v.id}
                className={`text-xs p-2 rounded ${v.isFatal ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}
              >
                <span className="font-medium">{v.isFatal ? '[致命] ' : ''}</span>
                {v.description}
                <span className="float-right font-bold">{v.penalty}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
