
import React from 'react';
import { ScoreResult } from '../types';
import { getGradeColor, getIssueIcon, getIssueName } from '../utils/scoring';

interface ScorePanelProps {
  score: ScoreResult | null;
  isCalculating?: boolean;
}

export const ScorePanel: React.FC<ScorePanelProps> = ({ score, isCalculating }) => {
  if (!score) {
    return (
      <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-20 bg-gray-700 rounded mb-4" />
          <div className="h-4 bg-gray-700 rounded mb-2" />
          <div className="h-4 bg-gray-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  const gradeColor = getGradeColor(score.grade);
  const circumference = 2 * Math.PI * 45;
  const progress = (score.overall / 100) * circumference;

  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4 backdrop-blur-sm">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="#374151"
              strokeWidth="6"
              fill="none"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke={gradeColor}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              style={{
                filter: `drop-shadow(0 0 8px ${gradeColor})`,
                transition: 'stroke-dashoffset 0.5s ease',
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-2xl font-bold"
              style={{
                color: gradeColor,
                fontFamily: 'Orbitron, sans-serif',
                textShadow: `0 0 10px ${gradeColor}`,
              }}
            >
              {score.grade}
            </span>
            <span className="text-xs text-gray-400">
              {score.overall.toFixed(0)}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <ScoreBar label="亮度" value={score.brightness} color="#00d4ff" />
          <ScoreBar label="色彩" value={score.color} color="#ff6b35" />
          <ScoreBar label="细节" value={score.detail} color="#00ff88" />
        </div>
      </div>

      {score.issues.length > 0 && (
        <div className="border-t border-gray-700 pt-3 mt-3">
          <div className="text-xs text-gray-400 mb-2" style={{ fontFamily: 'Roboto Mono, monospace' }}>
            检测到的问题:
          </div>
          <div className="space-y-2">
            {score.issues.map((issue, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 p-2 rounded text-xs ${
                  issue.severity === 'error'
                    ? 'bg-red-900/30 border border-red-700/50'
                    : 'bg-yellow-900/30 border border-yellow-700/50'
                }`}
              >
                <span className="text-lg">{getIssueIcon(issue.type)}</span>
                <div>
                  <div className="font-medium text-gray-200">
                    {getIssueName(issue.type)}
                  </div>
                  <div className="text-gray-400">{issue.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCalculating && (
        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center rounded-lg">
          <div className="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
};

interface ScoreBarProps {
  label: string;
  value: number;
  color: string;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, value, color }) => {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span style={{ color, fontFamily: 'Roboto Mono, monospace' }}>
          {value.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${value}%`,
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>
    </div>
  );
};
