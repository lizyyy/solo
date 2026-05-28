import { useState } from 'react';
import { useGame } from '../context/GameContext';
import type { ProblemDiscovery } from '../types';

const problemTypeNames: Record<ProblemDiscovery['type'], string> = {
  fatigue: '疲劳过高',
  knowledge_gap: '知识点短板',
  lack_of_review: '复盘缺失',
  imbalance: '发展不均衡',
};

const problemTypeIcons: Record<ProblemDiscovery['type'], string> = {
  fatigue: '😫',
  knowledge_gap: '📉',
  lack_of_review: '📚',
  imbalance: '⚖️',
};

const severityColors: Record<ProblemDiscovery['severity'], string> = {
  low: 'bg-blue-900/50 border-blue-700 text-blue-400',
  medium: 'bg-yellow-900/50 border-yellow-700 text-yellow-400',
  high: 'bg-red-900/50 border-red-700 text-red-400',
};

const severityNames: Record<ProblemDiscovery['severity'], string> = {
  low: '低',
  medium: '中',
  high: '高',
};

export const ProblemAnalysisPanel: React.FC = () => {
  const { state, confirmCorrection } = useGame();
  const [activeTab, setActiveTab] = useState<'problems' | 'corrections'>('problems');

  const recentProblems = state.problemDiscoveries.slice(-10).reverse();
  const recentCorrections = state.correctionActions.slice(-10).reverse();

  const getProblemForCorrection = (problemId: string): ProblemDiscovery | undefined => {
    return state.problemDiscoveries.find(p => p.id === problemId);
  };

  const handleConfirm = (correctionId: string) => {
    const confirmedBy = prompt('请输入确认人姓名:');
    if (confirmedBy) {
      confirmCorrection(correctionId, confirmedBy);
    }
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">🔍 问题分析</h2>
        <div className="flex gap-2 bg-slate-700/50 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('problems')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'problems'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            问题发现 ({state.problemDiscoveries.length})
          </button>
          <button
            onClick={() => setActiveTab('corrections')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'corrections'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            修正措施 ({state.correctionActions.length})
          </button>
        </div>
      </div>

      {activeTab === 'problems' && (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {recentProblems.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-2">✅</div>
              <p>暂未发现问题</p>
              <p className="text-sm">继续保持良好的训练节奏</p>
            </div>
          ) : (
            recentProblems.map(problem => (
              <div
                key={problem.id}
                className={`p-4 rounded-lg border animate-slide-in ${severityColors[problem.severity]}`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{problemTypeIcons[problem.type]}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">
                        {problemTypeNames[problem.type]}
                      </span>
                      <span className={`badge ${
                        problem.severity === 'high' ? 'badge-danger' : 
                        problem.severity === 'medium' ? 'badge-warning' : 'badge-info'
                      }`}>
                        {severityNames[problem.severity]}风险
                      </span>
                    </div>
                    <p className="text-sm opacity-90">{problem.description}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs opacity-75">
                      <span>第 {problem.day} 天</span>
                      <span>发现者: {problem.discoveredBy}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'corrections' && (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {recentCorrections.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-2">📋</div>
              <p>暂无修正措施</p>
              <p className="text-sm">发现问题后会自动生成建议措施</p>
            </div>
          ) : (
            recentCorrections.map(correction => {
              const problem = getProblemForCorrection(correction.problemId);
              const isConfirmed = correction.confirmedBy && correction.confirmedAt > 0;
              
              return (
                <div
                  key={correction.id}
                  className={`p-4 rounded-lg border animate-slide-in ${
                    isConfirmed
                      ? 'bg-green-900/30 border-green-700'
                      : 'bg-slate-700/50 border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{isConfirmed ? '✅' : '⏳'}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white">{correction.action}</span>
                        {isConfirmed ? (
                          <span className="badge badge-success">已确认</span>
                        ) : (
                          <span className="badge badge-warning">待确认</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 mb-2">{correction.description}</p>
                      <p className="text-sm text-blue-400 mb-2">
                        🎯 预期效果: {correction.expectedEffect}
                      </p>
                      {problem && (
                        <p className="text-xs text-slate-400 mb-2">
                          🔗 关联问题: {problem.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                          第 {correction.day} 天
                        </div>
                        {isConfirmed ? (
                          <div className="text-xs text-green-400">
                            确认人: {correction.confirmedBy}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConfirm(correction.id)}
                            className="btn-success text-xs py-1 px-3"
                          >
                            确认执行
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className="text-2xl font-bold text-red-400">
              {state.problemDiscoveries.filter(p => p.severity === 'high').length}
            </div>
            <div className="text-slate-400">高风险</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">
              {state.problemDiscoveries.filter(p => p.severity === 'medium').length}
            </div>
            <div className="text-slate-400">中风险</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">
              {state.correctionActions.filter(c => c.confirmedBy).length}
            </div>
            <div className="text-slate-400">已确认</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">
              {state.correctionActions.filter(c => !c.confirmedBy).length}
            </div>
            <div className="text-slate-400">待确认</div>
          </div>
        </div>
      </div>
    </div>
  );
};
