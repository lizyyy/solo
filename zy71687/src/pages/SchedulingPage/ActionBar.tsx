import { useStore } from '@/store/useStore'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

const steps = [
  { key: 'match', label: '锁汇匹配' },
  { key: 'trial', label: '排程试算' },
  { key: 'execute', label: '批量执行' },
] as const

export default function ActionBar() {
  const { isMatched, trialResult, isExecuted, runMatchingEngine, runTrial, executeBatchPlans } = useStore()

  const stepStates = [
    isMatched ? 'done' : 'pending',
    isMatched && !trialResult ? 'active' : trialResult ? 'done' : 'pending',
    trialResult && !isExecuted ? 'active' : isExecuted ? 'done' : 'pending',
  ]

  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-3">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {stepStates[i] === 'done' ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : stepStates[i] === 'active' ? (
                <Circle size={16} className="text-sky-400 fill-sky-400/30" />
              ) : (
                <Circle size={16} className="text-white/20" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  stepStates[i] === 'done'
                    ? 'text-emerald-400'
                    : stepStates[i] === 'active'
                      ? 'text-sky-400'
                      : 'text-white/30'
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('w-8 h-px', stepStates[i] === 'done' ? 'bg-emerald-400/50' : 'bg-white/10')} />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <button
          onClick={runMatchingEngine}
          disabled={isMatched}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-semibold transition-all',
            isMatched
              ? 'bg-[#00d4aa]/10 text-[#00d4aa]/40 cursor-not-allowed'
              : 'bg-[#00d4aa] text-[#0f1219] hover:bg-[#00d4aa]/90'
          )}
        >
          执行锁汇匹配
        </button>
        <button
          onClick={runTrial}
          disabled={!isMatched || !!trialResult}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-semibold transition-all',
            isMatched && !trialResult
              ? 'bg-[#38bdf8] text-[#0f1219] hover:bg-[#38bdf8]/90'
              : 'bg-[#38bdf8]/10 text-[#38bdf8]/40 cursor-not-allowed'
          )}
        >
          执行排程试算
        </button>
        <button
          onClick={executeBatchPlans}
          disabled={!trialResult || isExecuted}
          className={cn(
            'px-4 py-2 rounded-lg text-xs font-semibold transition-all',
            trialResult && !isExecuted
              ? 'bg-[#f59e0b] text-[#0f1219] hover:bg-[#f59e0b]/90'
              : 'bg-[#f59e0b]/10 text-[#f59e0b]/40 cursor-not-allowed'
          )}
        >
          批量执行
        </button>
      </div>
    </div>
  )
}
