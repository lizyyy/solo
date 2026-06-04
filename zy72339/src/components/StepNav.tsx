import { cn } from '@/lib/utils'
import { Check, CircleDot, Circle } from 'lucide-react'
import type { WorkflowStep } from '@/types'
import { useNavigate, useLocation } from 'react-router-dom'

interface StepNavProps {
  steps: WorkflowStep[]
}

export default function StepNav({ steps }: StepNavProps) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className="w-64 shrink-0 border-r border-slate-200 bg-slate-50/80 p-6">
      <h2 className="mb-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
        流程步骤
      </h2>
      <ol className="space-y-1">
        {steps.map((step, idx) => {
          const isActive = location.pathname === step.path
          const isCompleted = step.status === 'completed'
          const isPending = step.status === 'pending'

          return (
            <li key={step.key}>
              <button
                onClick={() => navigate(step.path)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-all',
                  isActive && 'bg-orange-50 ring-1 ring-orange-200',
                  isCompleted && !isActive && 'hover:bg-slate-100',
                  isPending && !isActive && 'opacity-50 cursor-not-allowed'
                )}
                disabled={isPending && !isActive}
              >
                <span className="mt-0.5">
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-emerald-500" />
                  ) : isActive ? (
                    <CircleDot className="h-5 w-5 text-orange-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300" />
                  )}
                </span>
                <span className="flex flex-col">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isActive && 'text-orange-700',
                      isCompleted && !isActive && 'text-slate-600',
                      isPending && 'text-slate-400'
                    )}
                  >
                    {idx + 1}. {step.label}
                  </span>
                  <span className="mt-0.5 text-xs text-slate-400 leading-snug">
                    {step.description}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
