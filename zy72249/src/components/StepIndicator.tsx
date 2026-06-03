import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3
}

const steps = [
  { num: 1, label: '导入除权日截图' },
  { num: 2, label: '补看税费率备注' },
  { num: 3, label: '差异清单更新' },
]

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 py-6">
      {steps.map((step, idx) => {
        const isCompleted = currentStep > step.num
        const isActive = currentStep === step.num
        const isFuture = currentStep < step.num

        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300',
                  isCompleted && 'bg-[var(--color-amber)] text-white shadow-md',
                  isActive && 'bg-[var(--color-amber)] text-white ring-4 ring-[var(--color-amber)]/20 shadow-lg animate-step-pulse',
                  isFuture && 'border-2 border-gray-300 bg-white text-gray-400'
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : step.num}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  isActive && 'text-[var(--color-amber)]',
                  isCompleted && 'text-[var(--color-amber)]',
                  isFuture && 'text-gray-400'
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'mx-4 h-0.5 w-24 transition-colors duration-300',
                  currentStep > step.num ? 'bg-[var(--color-amber)]' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
