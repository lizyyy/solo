import React from 'react';
import { usePatternStore } from '@/store/patternStore';
import { AlertTriangle, AlertCircle, CheckCircle, Wrench, Zap, Volume2, VolumeX, Target } from 'lucide-react';

const issueIcons: Record<string, React.ReactNode> = {
  velocity_over: <Zap size={16} />,
  velocity_low: <VolumeX size={16} />,
  density_high: <Target size={16} />,
  empty_measure: <AlertCircle size={16} />,
};

const issueColors: Record<string, { bg: string; text: string; border: string }> = {
  warning: { bg: 'bg-neon-orange/10', text: 'text-neon-orange', border: 'border-neon-orange/30' },
  error: { bg: 'bg-neon-red/10', text: 'text-neon-red', border: 'border-neon-red/30' },
};

export const ValidationPanel: React.FC = () => {
  const { issues, fixIssue, pattern } = usePatternStore();

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const getTrackName = (trackId: string) => {
    return pattern.tracks.find((t) => t.id === trackId)?.name || '未知';
  };

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neon-blue flex items-center gap-2">
          <AlertTriangle size={20} />
          节奏校验
        </h2>
        <div className="flex items-center gap-3 text-sm">
          {errors.length > 0 && (
            <span className="flex items-center gap-1 text-neon-red">
              <AlertCircle size={14} />
              {errors.length} 错误
            </span>
          )}
          {warnings.length > 0 && (
            <span className="flex items-center gap-1 text-neon-orange">
              <AlertTriangle size={14} />
              {warnings.length} 警告
            </span>
          )}
          {issues.length === 0 && (
            <span className="flex items-center gap-1 text-neon-green">
              <CheckCircle size={14} />
              校验通过
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <CheckCircle size={32} className="text-neon-green mb-2" />
            <p>当前 Pattern 没有检测到问题</p>
          </div>
        ) : (
          issues.map((issue) => {
            const colors = issueColors[issue.severity];
            return (
              <div
                key={issue.id}
                className={`p-3 rounded-lg border ${colors.bg} ${colors.border} transition-all hover:border-opacity-50`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className={colors.text}>{issueIcons[issue.type]}</span>
                    <div>
                      <p className={`text-sm font-medium ${colors.text}`}>{issue.message}</p>
                      {issue.trackId && (
                        <p className="text-xs text-gray-500 mt-1">
                          轨道: {getTrackName(issue.trackId)} · 第 {issue.step + 1} 步
                        </p>
                      )}
                      {issue.suggestion && (
                        <p className="text-xs text-gray-400 mt-1">💡 {issue.suggestion}</p>
                      )}
                    </div>
                  </div>
                  {issue.type !== 'empty_measure' && issue.trackId && (
                    <button
                      onClick={() => fixIssue(issue.id)}
                      className="p-1.5 rounded bg-dark-700 hover:bg-dark-600 text-gray-400 hover:text-neon-blue transition-colors flex-shrink-0"
                      title="一键修复"
                    >
                      <Wrench size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-dark-600">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-2 bg-dark-700 rounded">
            <div className="text-neon-blue font-bold text-lg">
              {pattern.tracks.reduce((sum, t) => sum + t.notes.filter((n) => n.isActive).length, 0)}
            </div>
            <div className="text-gray-500">总音符数</div>
          </div>
          <div className="text-center p-2 bg-dark-700 rounded">
            <div className="text-neon-green font-bold text-lg">
              {pattern.tracks.filter((t) => t.notes.some((n) => n.isActive)).length}
            </div>
            <div className="text-gray-500">活跃轨道</div>
          </div>
          <div className="text-center p-2 bg-dark-700 rounded">
            <div className="text-neon-orange font-bold text-lg">{issues.length}</div>
            <div className="text-gray-500">待处理问题</div>
          </div>
        </div>
      </div>
    </div>
  );
};
