import React from 'react';
import { X, Trophy, Target, Clock, AlertTriangle, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { ExportPanel } from './ExportPanel';
import { getFailureTypeLabel } from '../utils/judgmentEngine';
import { levels } from '../data/levels';

export const SettlementModal: React.FC = () => {
  const { showSettlement, setShowSettlement, settlementReport, currentLevelId, restartSession } = useGameStore();

  if (!showSettlement || !settlementReport) return null;

  const level = levels.find((l) => l.id === currentLevelId);
  const accuracyColor = settlementReport.accuracy >= 80 ? 'text-emerald-400' : settlementReport.accuracy >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-industrial-panel border border-industrial-border rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-industrial-border">
          <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
            <Trophy size={24} />
            演练结算报告
          </h2>
          <button
            onClick={() => setShowSettlement(false)}
            className="p-1 hover:bg-industrial-border rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-industrial-text mb-1">{settlementReport.levelName}</h3>
            <p className="text-sm text-industrial-muted">{settlementReport.levelDescription}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="industrial-panel p-4 text-center">
              <div className="flex justify-center mb-2">
                <Trophy className="text-amber-400" size={24} />
              </div>
              <div className="text-3xl font-bold text-amber-400 font-mono">
                {settlementReport.totalScore}
              </div>
              <div className="text-xs text-industrial-muted mt-1">
                / {settlementReport.maxScore} 分
              </div>
            </div>

            <div className="industrial-panel p-4 text-center">
              <div className="flex justify-center mb-2">
                <Target className="text-emerald-400" size={24} />
              </div>
              <div className={`text-3xl font-bold font-mono ${accuracyColor}`}>
                {settlementReport.accuracy.toFixed(1)}%
              </div>
              <div className="text-xs text-industrial-muted mt-1">
                {settlementReport.correctCount}/{settlementReport.totalProblems} 正确
              </div>
            </div>

            <div className="industrial-panel p-4 text-center">
              <div className="flex justify-center mb-2">
                <Clock className="text-blue-400" size={24} />
              </div>
              <div className="text-3xl font-bold text-blue-400 font-mono">
                {settlementReport.avgResponseTime.toFixed(0)}
              </div>
              <div className="text-xs text-industrial-muted mt-1">平均响应 (ms)</div>
            </div>

            <div className="industrial-panel p-4 text-center">
              <div className="flex justify-center mb-2">
                <AlertTriangle className="text-red-400" size={24} />
              </div>
              <div className="text-3xl font-bold text-red-400 font-mono">
                {settlementReport.wrongCount + settlementReport.timeoutCount}
              </div>
              <div className="text-xs text-industrial-muted mt-1">总失败数</div>
            </div>
          </div>

          <div className="industrial-panel p-4">
            <h4 className="font-semibold text-industrial-text mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-amber-400" />
              失败类型分布
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-industrial-bg p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="text-red-400" size={16} />
                  <span className="text-sm font-medium">规则误解</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-red-400 font-mono">
                    {settlementReport.failureBreakdown.ruleMisunderstanding}
                  </div>
                  <div className="flex-1 bg-industrial-border rounded-full h-2">
                    <div
                      className="bg-red-500 h-full rounded-full"
                      style={{
                        width: `${settlementReport.totalProblems > 0 ? (settlementReport.failureBreakdown.ruleMisunderstanding / settlementReport.totalProblems) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-industrial-bg p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="text-amber-400" size={16} />
                  <span className="text-sm font-medium">操作超时</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-amber-400 font-mono">
                    {settlementReport.failureBreakdown.operationTimeout}
                  </div>
                  <div className="flex-1 bg-industrial-border rounded-full h-2">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{
                        width: `${settlementReport.totalProblems > 0 ? (settlementReport.failureBreakdown.operationTimeout / settlementReport.totalProblems) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="industrial-panel p-4">
            <h4 className="font-semibold text-industrial-text mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-400" />
              失败详情分析
            </h4>
            {settlementReport.problemDetails.filter((p) => !p.isCorrect).length === 0 ? (
              <div className="text-center py-8 text-emerald-400">
                <CheckCircle size={48} className="mx-auto mb-2" />
                <p>全部正确！没有失败项</p>
              </div>
            ) : (
              <div className="space-y-3">
                {settlementReport.problemDetails
                  .filter((p) => !p.isCorrect)
                  .map((problem, idx) => (
                    <div
                      key={problem.problemId}
                      className={`p-3 rounded-lg border ${
                        problem.failureType === 'rule_misunderstanding'
                          ? 'bg-red-900/20 border-red-800/50'
                          : 'bg-amber-900/20 border-amber-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                problem.failureType === 'rule_misunderstanding'
                                  ? 'bg-red-600/30 text-red-400'
                                  : 'bg-amber-600/30 text-amber-400'
                              }`}
                            >
                              {getFailureTypeLabel(problem.failureType)}
                            </span>
                            <span className="font-medium text-industrial-text">
                              {problem.problemTitle}
                            </span>
                          </div>
                          <div className="text-sm text-industrial-muted space-y-1">
                            <div>
                              你的选择：
                              <span className="text-red-400 ml-1">
                                {problem.playerChoiceLabel || problem.playerChoice || '未选择'}
                              </span>
                            </div>
                            <div>
                              正确答案：
                              <span className="text-emerald-400 ml-1">{problem.correctChoiceLabel}</span>
                            </div>
                            <div className="mt-2">
                              <span className="text-industrial-muted">原因：</span>
                              <ul className="mt-1 space-y-0.5">
                                {problem.reasons.map((r, i) => (
                                  <li key={i} className="text-xs text-industrial-muted pl-4">
                                    • {r}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {problem.rules.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {problem.rules.map((r) => (
                                  <span
                                    key={r}
                                    className="px-1.5 py-0.5 bg-industrial-bg text-[10px] text-amber-400 rounded"
                                  >
                                    {r}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-xl font-bold font-mono ${
                              problem.scoreChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {problem.scoreChange >= 0 ? '+' : ''}
                            {problem.scoreChange}
                          </div>
                          <div className="text-xs text-industrial-muted">{problem.responseTime}ms</div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {settlementReport.supplementaryNoteDiff && (
            <div className="industrial-panel p-4">
              <h4 className="font-semibold text-blue-400 mb-3">📌 补录备注差异</h4>
              <div className="bg-blue-900/20 border border-blue-800/50 p-3 rounded font-mono text-xs whitespace-pre-wrap text-industrial-text">
                {settlementReport.supplementaryNoteDiff}
              </div>
            </div>
          )}

          <ExportPanel report={settlementReport} />
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-industrial-border bg-industrial-bg/50">
          <button
            onClick={() => {
              setShowSettlement(false);
              restartSession();
            }}
            className="industrial-button-primary flex items-center gap-2"
          >
            再来一次
          </button>
          <button
            onClick={() => setShowSettlement(false)}
            className="industrial-button-secondary"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
