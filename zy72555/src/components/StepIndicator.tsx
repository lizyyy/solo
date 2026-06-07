import type { WorkflowStep } from '@/types';
import { Check, FileInput, BookOpen, RefreshCw } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: WorkflowStep;
  onStepClick?: (step: WorkflowStep) => void;
}

const steps: { key: WorkflowStep; label: string; description: string; Icon: any }[] = [
  {
    key: 'import',
    label: '第一步',
    description: '训练日志曲线第一次导入',
    Icon: FileInput,
  },
  {
    key: 'review',
    label: '第二步',
    description: '评测运营小孟补看阈值调参笔记',
    Icon: BookOpen,
  },
  {
    key: 'replay',
    label: '第三步',
    description: '阈值回放更新',
    Icon: RefreshCw,
  },
];

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-between w-full max-w-3xl mx-auto">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const Icon = step.Icon;

        return (
          <div key={step.key} className="flex items-center">
            <button
              onClick={() => onStepClick?.(step.key)}
              className={`flex flex-col items-center group transition-all duration-300 ${
                onStepClick ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                    : isCurrent
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {isCompleted ? <Check size={24} /> : <Icon size={24} />}
              </div>
              <div className="mt-3 text-center">
                <div
                  className={`text-sm font-semibold ${
                    isCurrent ? 'text-blue-400' : isCompleted ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-xs text-slate-500 mt-1 max-w-[140px]">{step.description}</div>
              </div>
            </button>
            {index < steps.length - 1 && (
              <div
                className={`w-20 h-0.5 mx-2 mb-8 transition-all duration-500 ${
                  index < currentIndex ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
