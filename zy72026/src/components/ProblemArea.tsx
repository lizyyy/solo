import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { levels } from '../data/levels';
import { getRuleByCode } from '../data/rules';
import type { WarehouseReceiptProblem } from '../types';

export const ProblemArea: React.FC = () => {
  const { session, currentLevelId, makeChoice } = useGameStore();
  const [showRules, setShowRules] = useState(false);

  const level = levels.find((l) => l.id === currentLevelId);
  const problem: WarehouseReceiptProblem | undefined =
    level?.problems[session?.currentProblemIndex ?? 0];

  const currentJudgment = problem ? session?.judgments[problem.id] : undefined;

  if (!session || !level || !problem) {
    return (
      <div className="industrial-panel p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-bold text-industrial-text mb-2">期货仓单抢修队</h2>
          <p className="text-industrial-muted mb-4">
            选择关卡后点击"开始"或"跑样例"启动演练
          </p>
          <div className="text-sm text-industrial-muted bg-industrial-bg p-4 rounded-lg">
            <p className="font-semibold text-amber-400 mb-2">演练说明：</p>
            <ul className="text-left space-y-1">
              <li>• 模拟期货仓单业务的应急处理场景</li>
              <li>• 在规定时间内做出正确的操作选择</li>
              <li>• 系统会实时判断并记录每一步决策</li>
              <li>• 结算后可导出完整的复盘报告</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'completed') {
    return (
      <div className="industrial-panel p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-emerald-400 mb-2">演练已完成</h2>
          <p className="text-industrial-muted mb-4">
            最终得分：<span className="font-mono text-2xl font-bold text-amber-400">{session.score}</span> 分
          </p>
          <p className="text-sm text-industrial-muted">
            点击"再来一次"重新开始，或查看右侧时间线和结算报告
          </p>
        </div>
      </div>
    );
  }

  const isAnswered = !!currentJudgment;

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="industrial-panel p-6 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-amber-600/20 text-amber-400 text-xs font-semibold rounded">
                问题 {session.currentProblemIndex + 1}
              </span>
              <span className="text-industrial-muted text-sm">
                限时 {problem.timeLimit} 秒
              </span>
            </div>
            <h2 className="text-xl font-bold text-industrial-text">{problem.title}</h2>
          </div>
        </div>

        <div className="bg-industrial-bg p-4 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <FileText className="text-amber-400 flex-shrink-0 mt-1" size={20} />
            <p className="text-industrial-text leading-relaxed">{problem.description}</p>
          </div>
        </div>

        <div className="mb-4">
          <button
            onClick={() => setShowRules(!showRules)}
            className="flex items-center gap-2 text-sm text-industrial-muted hover:text-amber-400 transition-colors mb-2"
          >
            {showRules ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            查看关联规则 ({problem.ruleReferences.length})
          </button>
          {showRules && (
            <div className="bg-industrial-bg border border-industrial-border rounded-lg p-4 space-y-3">
              {problem.ruleReferences.map((code) => {
                const rule = getRuleByCode(code);
                return rule ? (
                  <div key={code} className="text-sm">
                    <div className="font-semibold text-amber-400">{rule.code}</div>
                    <div className="text-industrial-muted">{rule.description}</div>
                  </div>
                ) : (
                  <div key={code} className="text-sm text-industrial-muted">
                    {code}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-industrial-muted mb-2">请选择操作：</h3>
          {problem.options.map((option, index) => {
            let buttonClass = 'choice-button';
            if (isAnswered) {
              if (option.id === problem.correctOptionId) {
                buttonClass += ' correct';
              } else if (currentJudgment && session.playerChoices[problem.id]?.optionId === option.id && !currentJudgment.isCorrect) {
                buttonClass += ' wrong';
              }
            }

            return (
              <button
                key={option.id}
                onClick={() => !isAnswered && session.status === 'running' && makeChoice(option.id)}
                disabled={isAnswered || session.status !== 'running'}
                className={buttonClass}
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-industrial-panel border border-industrial-border rounded font-mono font-bold text-amber-400">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold">{option.label}</div>
                    {option.description && (
                      <div className="text-sm text-industrial-muted mt-1">{option.description}</div>
                    )}
                  </div>
                  {option.shortcut && (
                    <kbd className="px-2 py-1 bg-industrial-panel border border-industrial-border rounded text-xs text-industrial-muted">
                      {option.shortcut}
                    </kbd>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {isAnswered && !currentJudgment?.isCorrect && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <div className="font-semibold text-red-400">回答错误</div>
              <div className="text-sm text-industrial-muted mt-1">
                正确答案已标绿，请仔细理解规则后继续。
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
