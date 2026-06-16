import type { ReasoningChain, StepType, SuggestionLevel } from '@/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

const STEP_TYPE_LABELS: Record<StepType, string> = {
  param_ref: '参数引用',
  weight_calc: '权重计算',
  threshold_cmp: '阈值比对',
  conclusion: '结论',
};

const STEP_TYPE_PILL_COLORS: Record<StepType, string> = {
  param_ref: 'bg-blue-100 text-blue-700',
  weight_calc: 'bg-purple-100 text-purple-700',
  threshold_cmp: 'bg-orange-100 text-orange-700',
  conclusion: 'bg-gray-100 text-gray-700',
};

const LEVEL_COLORS: Record<SuggestionLevel, string> = {
  pass: 'bg-green-500',
  warn: 'bg-yellow-500',
  fail: 'bg-red-500',
};

const LEVEL_BORDER_COLORS: Record<SuggestionLevel, string> = {
  pass: 'border-l-green-500',
  warn: 'border-l-yellow-500',
  fail: 'border-l-red-500',
};

const LEVEL_LINE_COLORS: Record<SuggestionLevel, string> = {
  pass: 'bg-green-300',
  warn: 'bg-yellow-300',
  fail: 'bg-red-300',
};

const LevelIcon = ({ level }: { level: SuggestionLevel }) => {
  switch (level) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'warn':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'fail':
      return <XCircle className="h-4 w-4 text-red-600" />;
  }
};

interface ReasoningChainProps {
  chain: ReasoningChain;
}

export default function ReasoningChainPanel({ chain }: ReasoningChainProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        {chain.steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div
              className={cn(
                'h-5 w-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center',
                LEVEL_COLORS[chain.level]
              )}
            >
              <LevelIcon level={chain.level} />
            </div>
            {idx < chain.steps.length - 1 && (
              <div className={cn('w-0.5 flex-1 min-h-[24px]', LEVEL_LINE_COLORS[chain.level])} />
            )}
          </div>
        ))}
        <div className={cn('w-0.5 flex-1 min-h-[16px]', LEVEL_LINE_COLORS[chain.level])} />
        <div
          className={cn(
            'h-7 w-7 rounded-full border-2 border-white shadow flex items-center justify-center',
            LEVEL_COLORS[chain.level]
          )}
        >
          <LevelIcon level={chain.level} />
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1 min-w-0 pb-2">
        {chain.steps.map((step, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            <span
              className={cn(
                'inline-block text-xs font-medium px-2 py-0.5 rounded-full w-fit',
                STEP_TYPE_PILL_COLORS[step.stepType]
              )}
            >
              {STEP_TYPE_LABELS[step.stepType]}
            </span>
            <div
              className={cn(
                'bg-white rounded-lg shadow-sm p-3 border-l-4',
                LEVEL_BORDER_COLORS[chain.level]
              )}
            >
              <p className="text-sm text-gray-700">{step.description}</p>

              {step.stepType === 'weight_calc' && step.calculatedValue !== null && (
                <div className="mt-2 flex items-center gap-1 text-xs bg-purple-50 rounded px-2 py-1 font-mono">
                  <span className="text-purple-600">加权评分</span>
                  <ArrowRight className="h-3 w-3 text-purple-400" />
                  <span className="text-purple-800 font-semibold">
                    {step.calculatedValue.toFixed(2)}
                  </span>
                  {step.thresholdCompared && (
                    <>
                      <span className="text-purple-400 mx-1">|</span>
                      <span className="text-purple-600">阈值</span>
                      <ArrowRight className="h-3 w-3 text-purple-400" />
                      <span className="text-purple-800 font-semibold">
                        {step.thresholdCompared}
                      </span>
                    </>
                  )}
                </div>
              )}

              {step.stepType === 'threshold_cmp' && step.thresholdCompared && (
                <div className="mt-2 flex items-center gap-1 text-xs bg-orange-50 rounded px-2 py-1">
                  <span className="text-orange-600">比对</span>
                  <ArrowRight className="h-3 w-3 text-orange-400" />
                  <span className="text-orange-800 font-semibold">
                    {step.thresholdCompared}
                  </span>
                </div>
              )}

              <p className="mt-1.5 text-sm font-semibold text-gray-900">{step.conclusion}</p>
            </div>
          </div>
        ))}

        <div
          className={cn(
            'bg-white rounded-xl shadow p-4 border-2',
            chain.level === 'pass'
              ? 'border-green-300'
              : chain.level === 'warn'
                ? 'border-yellow-300'
                : 'border-red-300'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <LevelIcon level={chain.level} />
            <span className="text-base font-bold text-gray-900">最终建议</span>
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                chain.level === 'pass'
                  ? 'bg-green-100 text-green-700'
                  : chain.level === 'warn'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              )}
            >
              {chain.level === 'pass' ? '通过' : chain.level === 'warn' ? '需确认' : '越界驳回'}
            </span>
            {chain.needsManualReview && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                需人工确认
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-800">{chain.finalSuggestion}</p>
          <p className="text-sm text-gray-600 mt-1">{chain.suggestionReason}</p>
        </div>
      </div>
    </div>
  );
}
