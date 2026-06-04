import { Check } from 'lucide-react'

interface Step {
  label: string
  completed: boolean
  active: boolean
}

interface StepIndicatorProps {
  steps: Step[]
}

export default function StepIndicator({ steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                step.completed
                  ? 'bg-success text-white'
                  : step.active
                    ? 'animate-pulse bg-accent text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step.completed ? <Check size={16} /> : index + 1}
            </div>
            <span
              className={`mt-2 text-xs font-medium ${
                step.completed
                  ? 'text-success'
                  : step.active
                    ? 'text-accent'
                    : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`mx-3 h-0.5 w-12 rounded ${
                step.completed ? 'bg-success' : 'border-dashed border-gray-300 bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
