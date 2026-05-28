import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { ACTIVITY_NAMES, KNOWLEDGE_POINT_NAMES } from '../data/constants';
import type { GameStatus } from '../types';

interface ResultPageProps {
  onRestart: () => void;
}

const statusConfig: Record<GameStatus, { icon: string; title: string; color: string; bgColor: string }> = {
  won: {
    icon: '🏆',
    title: '恭喜通关！',
    color: 'text-yellow-400',
    bgColor: 'from-yellow-900/50 to-amber-900/50',
  },
  lost: {
    icon: '😔',
    title: '挑战失败',
    color: 'text-red-400',
    bgColor: 'from-red-900/50 to-rose-900/50',
  },
  crashed: {
    icon: '💥',
    title: '全员崩盘！',
    color: 'text-orange-400',
    bgColor: 'from-orange-900/50 to-red-900/50',
  },
  playing: {
    icon: '🎮',
    title: '游戏进行中',
    color: 'text-blue-400',
    bgColor: 'from-blue-900/50 to-indigo-900/50',
  },
};

export const ResultPage: React.FC<ResultPageProps> = ({ onRestart }) => {
  const { state, exportReport, exportReplay, restartGame } = useGame();
  const [activeTab, setActiveTab] = useState<'overview' | 'decisions' | 'problems' | 'members'>('overview');
  
  const config = statusConfig[state.status];

  const analyzeResult = () => {
    const analysis: { success: string[]; failure: string[]; warnings: string[] } = {
      success: [],
      failure: [],
      warnings: [],
    };

    if (state.totalScore >= state.targetScore) {
      analysis.success.push(`成功达成目标得分 ${state.totalScore}/${state.targetScore}`);
    } else {
      analysis.failure.push(`未达成目标得分 ${state.totalScore}/${state.targetScore}，差距 ${state.targetScore - state.totalScore} 分`);
    }

    const passedContests = state.completedContests.filter(c => c.passed).length;
    if (passedContests === state.completedContests.length && state.completedContests.length > 0) {
      analysis.success.push(`所有 ${state.completedContests.length} 场比赛全部通过！`);
    } else if (passedContests > 0) {
      analysis.warnings.push(`通过了 ${passedContests}/${state.completedContests.length} 场比赛`);
    } else {
      analysis.failure.push('没有通过任何一场比赛');
    }

    const totalCrashes = state.members.reduce((sum, m) => sum + m.crashCount, 0);
    if (totalCrashes === 0) {
      analysis.success.push('完美！没有任何队员崩盘');
    } else if (totalCrashes <= 2) {
      analysis.warnings.push(`共发生 ${totalCrashes} 次崩盘，控制得还不错`);
    } else {
      analysis.failure.push(`崩盘次数过多：${totalCrashes} 次，需要更好的休息安排`);
    }

    const totalReview = state.members.reduce((sum, m) => sum + m.reviewCount, 0);
    const totalPractice = state.members.reduce((sum, m) => sum + m.practiceCount, 0);
    const reviewRatio = totalPractice > 0 ? totalReview / totalPractice : 0;
    
    if (reviewRatio >= 0.3) {
      analysis.success.push(`复盘比例合理（${Math.round(reviewRatio * 100)}%），知识点巩固良好`);
    } else if (reviewRatio >= 0.15) {
      analysis.warnings.push(`复盘比例偏低（${Math.round(reviewRatio * 100)}%），可以适当增加复盘`);
    } else {
      analysis.failure.push(`严重缺乏复盘（${Math.round(reviewRatio * 100)}%），知识点容易遗忘`);
    }

    state.members.forEach(member => {
      const kpValues = Object.values(member.knowledgePoints);
      const maxKp = Math.max(...kpValues);
      const minKp = Math.min(...kpValues);
      const gap = maxKp - minKp;
      
      if (gap > 40) {
        analysis.failure.push(`队员「${member.name}」知识点严重偏科，差距达 ${gap} 点`);
      } else if (gap > 25) {
        analysis.warnings.push(`队员「${member.name}」知识点有一定差距（${gap} 点）`);
      }
    });

    const avgFatigue = state.members.reduce((sum, m) => sum + m.fatigue, 0) / state.members.length;
    if (avgFatigue < 50) {
      analysis.success.push(`最终平均疲劳控制良好（${Math.round(avgFatigue)}%）`);
    } else if (avgFatigue < 80) {
      analysis.warnings.push(`最终平均疲劳偏高（${Math.round(avgFatigue)}%）`);
    } else {
      analysis.failure.push(`最终平均疲劳过高（${Math.round(avgFatigue)}%），训练安排不合理`);
    }

    return analysis;
  };

  const analysis = analyzeResult();

  const handleExportReport = () => {
    const report = exportReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportReplay = () => {
    const replay = exportReplay();
    const blob = new Blob([replay], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className={`text-center p-8 rounded-2xl mb-6 bg-gradient-to-r ${config.bgColor} border-2 border-white/20`}>
          <div className="text-6xl mb-4">{config.icon}</div>
          <h1 className={`text-4xl font-bold mb-2 ${config.color}`}>{config.title}</h1>
          <p className="text-slate-300 text-lg">
            最终得分: <span className="font-bold text-white">{state.totalScore}</span> / {state.targetScore}
          </p>
          <p className="text-slate-400 mt-2">
            游戏时长: {state.currentDay - 1} 天
          </p>
        </div>

        <div className="flex gap-2 mb-6 justify-center flex-wrap">
          {(['overview', 'decisions', 'problems', 'members'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
              }`}
            >
              {tab === 'overview' && '📊 总览分析'}
              {tab === 'decisions' && '🎯 关键决策'}
              {tab === 'problems' && '🔍 问题分析'}
              {tab === 'members' && '👥 队员表现'}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-900/30 border border-green-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-green-400 mb-4">✅ 做得好的地方</h3>
                {analysis.success.length > 0 ? (
                  <ul className="space-y-2">
                    {analysis.success.map((item, idx) => (
                      <li key={idx} className="text-slate-200 flex items-start gap-2">
                        <span className="text-green-400 mt-1">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">没有特别突出的表现</p>
                )}
              </div>

              <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-yellow-400 mb-4">⚠️ 需要注意</h3>
                {analysis.warnings.length > 0 ? (
                  <ul className="space-y-2">
                    {analysis.warnings.map((item, idx) => (
                      <li key={idx} className="text-slate-200 flex items-start gap-2">
                        <span className="text-yellow-400 mt-1">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">没有明显的警告</p>
                )}
              </div>

              <div className="bg-red-900/30 border border-red-700 rounded-xl p-6">
                <h3 className="text-lg font-bold text-red-400 mb-4">❌ 主要问题</h3>
                {analysis.failure.length > 0 ? (
                  <ul className="space-y-2">
                    {analysis.failure.map((item, idx) => (
                      <li key={idx} className="text-slate-200 flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">没有严重问题！</p>
                )}
              </div>
            </div>

            <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-4">📈 数据统计</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-400">
                    {state.completedContests.filter(c => c.passed).length}
                  </div>
                  <div className="text-sm text-slate-400">比赛通过</div>
                </div>
                <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-400">
                    {state.members.reduce((sum, m) => sum + m.practiceCount, 0)}
                  </div>
                  <div className="text-sm text-slate-400">总刷题数</div>
                </div>
                <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                  <div className="text-3xl font-bold text-green-400">
                    {state.members.reduce((sum, m) => sum + m.reviewCount, 0)}
                  </div>
                  <div className="text-sm text-slate-400">总复盘数</div>
                </div>
                <div className="text-center p-4 bg-slate-700/50 rounded-lg">
                  <div className="text-3xl font-bold text-orange-400">
                    {state.keyDecisions.length}
                  </div>
                  <div className="text-sm text-slate-400">关键决策</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'decisions' && (
          <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700 animate-fade-in">
            <h3 className="text-xl font-bold text-white mb-4">🎯 关键决策回顾</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {state.keyDecisions.slice().reverse().map((decision, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    decision.riskLevel === 'high'
                      ? 'bg-red-900/30 border-red-700'
                      : decision.riskLevel === 'medium'
                      ? 'bg-yellow-900/30 border-yellow-700'
                      : 'bg-blue-900/30 border-blue-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold text-white">{decision.description}</span>
                      <span className={`ml-2 badge ${
                        decision.riskLevel === 'high' ? 'badge-danger' : 
                        decision.riskLevel === 'medium' ? 'badge-warning' : 'badge-info'
                      }`}>
                        {decision.riskLevel === 'high' ? '高风险' : decision.riskLevel === 'medium' ? '中风险' : '低风险'}
                      </span>
                    </div>
                    <span className="text-sm text-slate-400">第 {decision.day} 天</span>
                  </div>
                  <p className="text-slate-300">{decision.impact}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-4">🔍 发现的问题</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {state.problemDiscoveries.length > 0 ? (
                  state.problemDiscoveries.slice().reverse().map((problem, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        problem.severity === 'high'
                          ? 'bg-red-900/30 border-red-700'
                          : problem.severity === 'medium'
                          ? 'bg-yellow-900/30 border-yellow-700'
                          : 'bg-blue-900/30 border-blue-700'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-white">
                            {problem.type === 'fatigue' ? '😫 疲劳过高' :
                             problem.type === 'knowledge_gap' ? '📉 知识点短板' :
                             problem.type === 'lack_of_review' ? '📚 复盘缺失' : '⚖️ 发展不均衡'}
                          </span>
                          <p className="text-sm text-slate-300 mt-1">{problem.description}</p>
                        </div>
                        <span className="text-xs text-slate-400">第 {problem.day} 天</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-center py-8">没有发现问题</p>
                )}
              </div>
            </div>

            <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-4">🔧 修正措施与确认</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {state.correctionActions.length > 0 ? (
                  state.correctionActions.slice().reverse().map((action, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        action.confirmedBy
                          ? 'bg-green-900/30 border-green-700'
                          : 'bg-slate-700/50 border-slate-600'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{action.action}</span>
                            {action.confirmedBy ? (
                              <span className="badge badge-success">已确认</span>
                            ) : (
                              <span className="badge badge-warning">未确认</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-300 mt-1">{action.description}</p>
                          <p className="text-xs text-blue-400 mt-1">预期: {action.expectedEffect}</p>
                          {action.confirmedBy && (
                            <p className="text-xs text-green-400 mt-1">
                              确认人: {action.confirmedBy}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">第 {action.day} 天</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-center py-8">没有修正措施</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
            {state.members.map(member => (
              <div key={member.id} className="bg-slate-800/80 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-4xl">{member.avatar}</div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{member.name}</h3>
                    <div className="text-sm text-slate-400">
                      最终能力: {member.overallAbility}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">最终疲劳</span>
                    <span className={`font-semibold ${
                      member.fatigue > 80 ? 'text-red-400' : member.fatigue > 50 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {Math.round(member.fatigue)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        member.fatigue > 80 ? 'bg-red-500' : member.fatigue > 50 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${member.fatigue}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {Object.entries(member.knowledgePoints).map(([kp, value]) => (
                    <div key={kp} className="text-center">
                      <div className="text-xs text-slate-400">
                        {KNOWLEDGE_POINT_NAMES[kp as keyof typeof KNOWLEDGE_POINT_NAMES]}
                      </div>
                      <div className="font-bold text-white">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-700">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-400">{member.practiceCount}</div>
                    <div className="text-xs text-slate-400">{ACTIVITY_NAMES.practice}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-400">{member.reviewCount}</div>
                    <div className="text-xs text-slate-400">{ACTIVITY_NAMES.review}</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xl font-bold ${member.crashCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {member.crashCount}
                    </div>
                    <div className="text-xs text-slate-400">崩盘</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-center gap-4 flex-wrap">
          <button onClick={onRestart} className="btn-primary">
            🔄 重新开局
          </button>
          <button onClick={handleExportReport} className="btn-secondary">
            📄 导出训练报告
          </button>
          <button onClick={handleExportReplay} className="btn-secondary">
            🎥 导出回放数据
          </button>
          <button onClick={restartGame} className="btn-danger">
            🗑️ 清除存档
          </button>
        </div>

        <div className="mt-6 text-center text-slate-500 text-sm">
          数据版本: {state.version.dataVersion} | 游戏ID: {state.id}
        </div>
      </div>
    </div>
  );
};
