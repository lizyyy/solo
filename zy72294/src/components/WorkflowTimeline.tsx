import { Upload, FileText, ClipboardList, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type StepType = 'import' | 'notes' | 'report'

interface WorkflowTimelineProps {
  currentStep: StepType
  stats: {
    pendingNotes: number
    pendingReviews: number
    pendingReports: number
  }
}

const steps: Array<{
  key: StepType
  label: string
  icon: typeof Upload
  badgeKey: 'pendingNotes' | 'pendingReviews' | 'pendingReports'
}> = [
  { key: 'import', label: '导入记录', icon: Upload, badgeKey: 'pendingNotes' },
  { key: 'notes', label: '补看备注', icon: FileText, badgeKey: 'pendingReviews' },
  { key: 'report', label: '更新报告', icon: ClipboardList, badgeKey: 'pendingReports' },
]

const stepOrder: Record<StepType, number> = {
  import: 0,
  notes: 1,
  report: 2,
}

export default function WorkflowTimeline({ currentStep, stats }: WorkflowTimelineProps) {
  const currentIndex = stepOrder[currentStep]

  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const Icon = step.icon
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const count = stats[step.badgeKey]

        return (
          <div key={step.key} className="relative flex items-start gap-4">
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'absolute left-5 top-12 w-0.5 h-16',
                  isCompleted ? 'bg-success-500' : 'bg-gray-200'
                )}
              />
            )}
            <div
              className={cn(
                'relative z-10 flex items-center justify-center rounded-full border-2 shrink-0',
                isCompleted && 'bg-success-500 border-success-500 text-white w-10 h-10',
                isCurrent && 'bg-industrial-500 border-industrial-500 text-white w-12 h-12 scale-110',
                !isCompleted && !isCurrent && 'bg-white border-gray-300 text-gray-400 w-10 h-10'
              )}
            >
              {isCompleted ? (
                <Check className={cn(isCurrent ? 'w-6 h-6' : 'w-5 h-5')} />
              ) : (
                <Icon className={cn(isCurrent ? 'w-6 h-6' : 'w-5 h-5')} />
              )}
            </div>
            <div className="flex-1 pt-1.5 pb-8">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'font-medium',
                    isCurrent && 'text-industrial-700 text-lg',
                    isCompleted && 'text-success-700',
                    !isCompleted && !isCurrent && 'text-gray-500'
                  )}
                >
                  {step.label}
                </span>
                {count > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-500 text-white">
                    {count}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
