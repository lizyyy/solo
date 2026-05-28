import React from 'react';
import { useGame } from '../context/GameContext';

export const StatusPanel: React.FC = () => {
  const { state, getUpcomingContest } = useGame();
  const upcomingContest = getUpcomingContest();

  const daysUntilContest = upcomingContest
    ? upcomingContest.day - state.currentDay + 1
    : null;

  const averageAbility = state.members.reduce((sum, m) => sum + m.overallAbility, 0) / state.members.length;
  const averageFatigue = state.members.reduce((sum, m) => sum + m.fatigue, 0) / state.members.length;
  const totalCrashCount = state.members.reduce((sum, m) => sum + m.crashCount, 0);

  const scoreProgress = (state.totalScore / state.targetScore) * 100;

  const getStatusColor = (percent: number) => {
    if (percent >= 70) return 'text-green-400';
    if (percent >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 70) return 'from-green-500 to-emerald-500';
    if (percent >= 40) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">📊 训练状态</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-700/50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-purple-400">{state.currentDay}</div>
          <div className="text-sm text-slate-400">当前天数</div>
          <div className="text-xs text-slate-500">/ {state.totalDays} 天</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4 text-center">
          <div className={`text-3xl font-bold ${getStatusColor(scoreProgress)}`}>
            {state.totalScore}
          </div>
          <div className="text-sm text-slate-400">当前得分</div>
          <div className="text-xs text-slate-500">目标: {state.targetScore}</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-400">{Math.round(averageAbility)}</div>
          <div className="text-sm text-slate-400">平均能力</div>
          <div className="text-xs text-slate-500">综合评估</div>
        </div>

        <div className={`bg-slate-700/50 rounded-lg p-4 text-center ${totalCrashCount > 0 ? 'ring-2 ring-red-500/50' : ''}`}>
          <div className={`text-3xl font-bold ${averageFatigue > 70 ? 'text-red-400' : averageFatigue > 40 ? 'text-yellow-400' : 'text-green-400'}`}>
            {Math.round(averageFatigue)}%
          </div>
          <div className="text-sm text-slate-400">平均疲劳</div>
          {totalCrashCount > 0 && (
            <div className="text-xs text-red-400">⚠️ 崩盘 {totalCrashCount} 次</div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400">得分进度</span>
          <span className={`font-semibold ${getStatusColor(scoreProgress)}`}>
            {Math.round(scoreProgress)}%
          </span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getProgressColor(scoreProgress)} progress-bar`}
            style={{ width: `${Math.min(100, scoreProgress)}%` }}
          />
        </div>
      </div>

      {upcomingContest && daysUntilContest !== null && daysUntilContest > 0 && (
        <div className={`p-4 rounded-lg border ${
          daysUntilContest <= 2 
            ? 'bg-red-900/30 border-red-700 animate-pulse' 
            : daysUntilContest <= 5 
            ? 'bg-yellow-900/30 border-yellow-700' 
            : 'bg-blue-900/30 border-blue-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🏆</div>
              <div>
                <div className="font-bold text-white">{upcomingContest.name}</div>
                <div className="text-sm text-slate-300">
                  第 {upcomingContest.day} 天 · {upcomingContest.problems.length} 题 · 目标 {upcomingContest.targetScore} 分
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${daysUntilContest <= 2 ? 'text-red-400' : 'text-blue-400'}`}>
                {daysUntilContest}
              </div>
              <div className="text-sm text-slate-400">天后</div>
            </div>
          </div>
        </div>
      )}

      {state.completedContests.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-400 mb-2">历史比赛</h3>
          <div className="space-y-2">
            {state.completedContests.map((contest, idx) => {
              const contestInfo = state.contests.find(c => c.id === contest.contestId);
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    contest.passed
                      ? 'bg-green-900/20 border-green-700'
                      : 'bg-red-900/20 border-red-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-white">
                        {contestInfo?.name || `比赛 #${idx + 1}`}
                      </div>
                      <div className="text-xs text-slate-400">第 {contest.day} 天</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${contest.passed ? 'text-green-400' : 'text-red-400'}`}>
                        {contest.totalScore} / {contest.targetScore}
                      </div>
                      <div className="text-xs text-slate-400">
                        排名 #{contest.rank} {contest.passed ? '✅' : '❌'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
