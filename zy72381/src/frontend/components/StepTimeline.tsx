import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { stepDescriptions } from '@/data/mockData'

export function StepTimeline() {
  const currentStep = useAppStore((state) => state.currentStep)

  const getStepStatus = (step: number) => {
    if (step < currentStep) return 'completed'
    if (step === currentStep) return 'active'
    return 'pending'
  }

  return (
    <div className="bg-industrial-800 rounded-lg p-6 card-shadow">
      <h2 className="text-lg font-bold text-industrial-100 mb-6 font-serif">
        处理流程进度
      </h2>
      <div className="space-y-4">
        {stepDescriptions.map(({ step, name, description }) => {
          const status = getStepStatus(step)
          return (
            <div key={step} className="flex items-start gap-4">
              <div className="relative flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    status === 'completed'
                      ? 'bg-success-500 text-white'
                      : status === 'active'
                      ? 'bg-industrial-600 text-white ring-4 ring-industrial-500/30'
                      : 'bg-industrial-700 text-industrial-400'
                  }`}
                >
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : status === 'active' ? (
                    <Clock className="w-5 h-5 animate-pulse" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>
                {step < stepDescriptions.length && (
                  <div
                    className={`w-0.5 h-12 mt-2 ${
                      status === 'completed'
                        ? 'bg-success-500'
                        : 'bg-industrial-700'
                    }`}
                  />
                )}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      status === 'completed'
                        ? 'text-success-400'
                        : status === 'active'
                        ? 'text-industrial-100'
                        : 'text-industrial-500'
                    }`}
                  >
                    步骤 {step}
                  </span>
                  {status === 'active' && (
                    <span className="px-2 py-0.5 text-xs bg-industrial-600 rounded text-industrial-200">
                      当前
                    </span>
                  )}
                </div>
                <h3
                  className={`font-semibold mt-1 ${
                    status === 'pending'
                      ? 'text-industrial-500'
                      : 'text-industrial-100'
                  }`}
                >
                  {name}
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    status === 'pending'
                      ? 'text-industrial-600'
                      : 'text-industrial-400'
                  }`}
                >
                  {description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
