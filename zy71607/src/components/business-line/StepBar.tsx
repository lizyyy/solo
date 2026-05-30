import { FileText, AlertTriangle, Percent, Receipt, GitCompareArrows, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

const steps = [
  { icon: FileText, label: '保单' },
  { icon: AlertTriangle, label: '出险' },
  { icon: Percent, label: '折扣' },
  { icon: Receipt, label: '报价' },
  { icon: GitCompareArrows, label: '比对' },
  { icon: Download, label: '报告' },
]

interface StepBarProps {
  activeStep: number
  onStepChange: (step: number) => void
  hasException: boolean[]
}

export default function StepBar({ activeStep, onStepChange, hasException }: StepBarProps) {
  return (
    <div className="flex items-center gap-1 px-2">
      {steps.map((step, index) => {
        const Icon = step.icon
        const isActive = index === activeStep
        const isPast = index < activeStep
        const hasIssue = hasException[index]

        return (
          <div key={step.label} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => onStepChange(index)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center',
                isActive && 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30',
                isPast && !isActive && 'bg-surface-700/50 text-surface-300 hover:bg-surface-700',
                !isActive && !isPast && 'text-surface-500 hover:text-surface-300 hover:bg-surface-700/30',
                hasIssue && !isActive && 'bg-accent-orange/10 text-accent-orange border border-accent-orange/20',
                hasIssue && isActive && 'bg-accent-red/20 text-accent-red border border-accent-red/30'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{step.label}</span>
              {hasIssue && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent-orange animate-pulse-soft" />
              )}
            </button>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-4 h-px flex-shrink-0',
                  isPast ? 'bg-accent-blue/40' : 'bg-surface-600'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
