import { Check } from 'lucide-react'

const steps = [
  { key: 'imported', label: '已导入' },
  { key: 'notes_supplemented', label: '已补录税费率' },
  { key: 'summary_updated', label: '摘要已更新' },
] as const

const statusOrder = ['imported', 'notes_supplemented', 'summary_updated']

interface ProgressStepsProps {
  status: 'imported' | 'notes_supplemented' | 'summary_updated'
}

export default function ProgressSteps({ status }: ProgressStepsProps) {
  const currentIndex = statusOrder.indexOf(status)

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isPending = index > currentIndex

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  isCompleted
                    ? 'bg-ledger-green text-white'
                    : isCurrent
                      ? 'bg-ledger-amber text-white'
                      : 'bg-ledger-border text-ledger-muted'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </div>
              <span
                className={`text-sm whitespace-nowrap ${
                  isCompleted
                    ? 'text-ledger-green font-medium'
                    : isCurrent
                      ? 'text-ledger-amber font-medium'
                      : 'text-ledger-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-2 ${
                  isCompleted ? 'bg-ledger-green' : 'bg-ledger-border'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
