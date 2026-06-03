import type { StepStatus } from '@/types'
import { Upload, FileText, Calculator, Check } from 'lucide-react'
import { useVarStore } from '@/store'

const STEPS: { key: StepStatus; label: string; icon: typeof Upload }[] = [
  { key: 'import', label: '① 导入原始行', icon: Upload },
  { key: 'boundary', label: '② 补看边界值说明', icon: FileText },
  { key: 'calculation', label: '③ 更新计算明细', icon: Calculator },
]

export default function StepNav() {
  const { currentStep, setCurrentStep } = useVarStore()

  const stepIndex = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isActive = step.key === currentStep
        const isCompleted = i < stepIndex
        const Icon = step.icon

        return (
          <div key={step.key} className="flex items-center">
            <button
              onClick={() => setCurrentStep(step.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 font-sans ${
                isActive
                  ? 'bg-accent-gold/15 text-text-gold border border-accent-gold/40 shadow-[0_0_12px_rgba(240,165,0,0.1)]'
                  : isCompleted
                  ? 'bg-accent-green/10 text-text-green border border-accent-green/30 cursor-pointer hover:bg-accent-green/15'
                  : 'bg-base-700 text-text-muted border border-surface-border cursor-pointer hover:bg-base-600'
              }`}
            >
              {isCompleted ? (
                <Check size={16} className="text-accent-green" />
              ) : (
                <Icon size={16} className={isActive ? 'text-accent-gold' : 'text-text-muted'} />
              )}
              <span>{step.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-1 ${i < stepIndex ? 'bg-accent-green/40' : 'bg-surface-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
