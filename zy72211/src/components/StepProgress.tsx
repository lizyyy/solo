import { useStore } from '@/store/useStore'
import type { WorkflowStep } from '@/types'
import { Check } from 'lucide-react'

const steps: { step: WorkflowStep; label: string; sub: string }[] = [
  { step: 1, label: '节假日顺延导入', sub: '导入顺延说明数据' },
  { step: 2, label: '尾差调整条补看', sub: '阿芬补看尾差调整条' },
  { step: 3, label: '摘要更新', sub: '给负责人看的摘要' },
]

export default function StepProgress() {
  const currentStep = useStore((s) => s.currentStep)
  const setStep = useStore((s) => s.setStep)

  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, i) => {
        const isActive = s.step === currentStep
        const isCompleted = s.step < currentStep
        return (
          <div key={s.step} className="flex items-center">
            <button
              onClick={() => setStep(s.step)}
              className="flex items-center gap-3 group cursor-pointer"
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                    : isActive
                    ? 'bg-[#1a365d] text-white shadow-md shadow-blue-200 ring-4 ring-blue-100'
                    : 'bg-slate-200 text-slate-400'
                }`}
              >
                {isCompleted ? <Check size={16} /> : s.step}
              </div>
              <div className="text-left">
                <p
                  className={`text-sm font-medium transition-colors ${
                    isActive ? 'text-[#1a365d]' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </p>
                <p className="text-xs text-slate-400">{s.sub}</p>
              </div>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-3 transition-colors duration-300 ${
                  s.step < currentStep ? 'bg-emerald-400' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
