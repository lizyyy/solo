import { ScoreDetail } from '../../types';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ScoreCardProps {
  title: string;
  icon: React.ReactNode;
  score: ScoreDetail;
  colorClass: string;
}

export function ScoreCard({ title, icon, score, colorClass }: ScoreCardProps) {
  const [expanded, setExpanded] = useState(false);

  const gradeColors: Record<string, string> = {
    A: 'text-green-400',
    B: 'text-blue-400',
    C: 'text-yellow-400',
    D: 'text-orange-400',
    F: 'text-red-400'
  };

  const circumference = 2 * Math.PI * 45;
  const progress = (score.value / 100) * circumference;

  return (
    <div className="card-bg rounded-lg p-4 border border-tech-500/30">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${colorClass}`}>
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-space-100">{title}</h4>
          <p className="text-xs text-space-400">权重: {(score.weight * 100).toFixed(0)}%</p>
        </div>
        <div className={`text-2xl font-bold font-orbitron ${gradeColors[score.grade]}`}>
          {score.grade}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="45"
              fill="none"
              stroke="rgba(100, 255, 218, 0.1)"
              strokeWidth="6"
            />
            <circle
              cx="48"
              cy="48"
              r="45"
              fill="none"
              stroke="#64FFDA"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-orbitron text-xl font-bold text-tech-400">
              {score.value.toFixed(0)}
            </span>
          </div>
        </div>

        <div className="flex-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-tech-400 hover:text-tech-300 mb-2"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? '收起计算过程' : '查看计算过程'}
          </button>

          {expanded && (
            <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
              {score.calculation.map((step, idx) => (
                <div key={idx} className="bg-space-700/50 rounded p-2 text-xs">
                  <div className="font-mono text-tech-300 mb-1">{step.formula}</div>
                  <div className="text-space-400 mb-1">
                    输入: {Object.entries(step.inputs).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(', ')}
                  </div>
                  <div className="text-space-400 mb-1">
                    中间: {Object.entries(step.intermediate).map(([k, v]) => `${k}=${v.toFixed(4)}`).join(', ')}
                  </div>
                  <div className="text-tech-400 font-semibold">
                    结果: {step.result.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
