import React from 'react';
import type { TransitionScore } from '@/types';

interface ScoreDisplayProps {
  score: TransitionScore;
  trackName?: string;
}

const getScoreColor = (score: number): string => {
  if (score >= 90) return 'text-accent-green';
  if (score >= 75) return 'text-accent-cyan';
  if (score >= 60) return 'text-accent-yellow';
  return 'text-accent-red';
};

const getScoreBgColor = (score: number): string => {
  if (score >= 90) return 'from-accent-green/20 to-accent-green/5';
  if (score >= 75) return 'from-accent-cyan/20 to-accent-cyan/5';
  if (score >= 60) return 'from-accent-yellow/20 to-accent-yellow/5';
  return 'from-accent-red/20 to-accent-red/5';
};

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score, trackName }) => {
  const dimensions = [
    { label: 'BPM匹配度', value: score.bpmMatchScore, weight: 0.4 },
    { label: '拍点对齐度', value: score.beatAlignScore, weight: 0.3 },
    { label: '段落适配度', value: score.segmentFitScore, weight: 0.3 },
  ];

  return (
    <div className={`bg-gradient-to-br ${getScoreBgColor(score.overallScore)} rounded-xl p-6 border border-bg-tertiary`}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h4 className="text-lg font-semibold mb-1">过渡评分</h4>
          {trackName && (
            <p className="text-sm text-text-muted">与 {trackName} 的匹配度</p>
          )}
        </div>
        <div className="text-right">
          <div className={`text-5xl font-bold ${getScoreColor(score.overallScore)}`}>
            {score.overallScore}
          </div>
          <div className="text-xs text-text-muted">综合评分</div>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {dimensions.map((dim) => (
          <div key={dim.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-text-secondary">{dim.label}</span>
              <span className={`font-mono font-medium ${getScoreColor(dim.value)}`}>
                {dim.value}分
              </span>
            </div>
            <div className="h-2 bg-bg-primary/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  dim.value >= 75 ? 'bg-accent-cyan' :
                  dim.value >= 60 ? 'bg-accent-yellow' : 'bg-accent-red'
                }`}
                style={{ width: `${dim.value}%` }}
              />
            </div>
            <div className="text-xs text-text-muted mt-1">
              权重: {(dim.weight * 100)}%
            </div>
          </div>
        ))}
      </div>

      <div className="bg-bg-primary/30 rounded-lg p-4">
        <p className="text-sm text-text-secondary">
          <span className="text-accent-cyan font-medium">💡 建议：</span>
          {score.recommendation}
        </p>
      </div>

      <div className="text-xs text-text-muted mt-4 text-right">
        评分时间: {new Date(score.createdAt).toLocaleString('zh-CN')}
      </div>
    </div>
  );
};

export default ScoreDisplay;
