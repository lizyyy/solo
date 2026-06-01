import React from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { levels } from '../data/levels';
import { getFailureTypeLabel } from '../utils/judgmentEngine';

export const JudgmentBanner: React.FC = () => {
  const { session, currentLevelId } = useGameStore();
  const level = levels.find((l) => l.id === currentLevelId);
  const problem = level?.problems[session?.currentProblemIndex ?? 0];
  const judgment = problem ? session?.judgments[problem.id] : undefined;

  if (!session || !judgment || session.status === 'idle' || session.status === 'completed') {
    return null;
  }

  const isLatestJudgment = session.events.filter((e) => e.type === 'judgment').pop()?.problemId === problem?.id;

  if (!isLatestJudgment) return null;

  const isCorrect = judgment.isCorrect;
  const failureType = judgment.failureType;
  const isTimeout = failureType === 'operation_timeout';

  return (
    <div className={`animate-slide-in p-4 rounded-lg border-2 ${
      isCorrect
        ? 'bg-emerald-900/30 border-emerald-500'
        : isTimeout
        ? 'bg-amber-900/30 border-amber-500'
        : 'bg-red-900/30 border-red-500'
    }`}>
      <div className="flex items-start gap-3">
        {isCorrect ? (
          <CheckCircle className="text-emerald-400 flex-shrink-0" size={24} />
        ) : isTimeout ? (
          <Clock className="text-amber-400 flex-shrink-0" size={24} />
        ) : (
          <XCircle className="text-red-400 flex-shrink-0" size={24} />
        )}
        <div className="flex-1">
          <div className={`font-bold text-lg ${
            isCorrect ? 'text-emerald-400' : isTimeout ? 'text-amber-400' : 'text-red-400'
          }`}>
            {isCorrect ? '✓ 判断正确' : `✗ ${getFailureTypeLabel(failureType)}`}
          </div>
          <div className="text-sm text-industrial-text mt-1">
            得分：<span className={`font-mono font-bold ${judgment.scoreChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {judgment.scoreChange >= 0 ? '+' : ''}{judgment.scoreChange}
            </span> 分
          </div>
          <div className="mt-3 space-y-2">
            {judgment.reasons.map((reason, idx) => (
              <div key={idx} className="text-sm text-industrial-muted flex items-start gap-2">
                <span className="text-amber-400">•</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-industrial-border">
            <div className="text-xs text-industrial-muted mb-2">判断链：</div>
            <div className="space-y-1">
              {judgment.judgmentChain.map((step, idx) => (
                <div key={idx} className="text-xs font-mono flex items-center gap-2">
                  <span className={`w-4 h-4 flex items-center justify-center rounded-full ${step.result ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {step.result ? '✓' : '✗'}
                  </span>
                  <span className="text-industrial-muted">{step.step}</span>
                  <span className="text-industrial-muted">→</span>
                  <span className={step.result ? 'text-emerald-400' : 'text-red-400'}>
                    {step.result ? '通过' : '不通过'}
                  </span>
                  {step.note && (
                    <span className="text-amber-400 ml-2">({step.note})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          {judgment.ruleReferences.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {judgment.ruleReferences.map((rule) => (
                <span key={rule} className="px-2 py-0.5 bg-industrial-bg text-xs text-amber-400 rounded border border-amber-600/30">
                  {rule}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
