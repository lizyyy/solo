import { Check } from 'lucide-react'
import type { StepStatus } from '@/store/useStore'

const steps = [
  { key: 'imported' as const, label: '问卷导入' },
  { key: 'reviewed' as const, label: '补看边界值说明' },
  { key: 'updated' as const, label: '更新演示结果' },
]

const stepOrder: StepStatus[] = ['imported', 'reviewed', 'updated']

export default function StepIndicator({ currentStep }: { currentStep: StepStatus }) {
  const currentIndex = stepOrder.indexOf(currentStep)

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div key={step.key} className="flex items-center gap-2">
            {index > 0 && (
              <div
                className={`w-8 h-px ${
                  index <= currentIndex ? 'bg-amber-500' : 'bg-slate-600'
                }`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 ${
                  isCompleted
                    ? 'bg-amber-500 text-slate-900'
                    : isCurrent
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500'
                    : 'bg-slate-700 text-slate-500'
                }`}
              >
                {isCompleted ? <Check size={12} /> : index + 1}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isCurrent ? 'text-amber-400 font-medium' : isCompleted ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
