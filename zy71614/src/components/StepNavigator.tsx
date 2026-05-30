import { Check } from 'lucide-react';

const STEPS = ['票房归集', '场次映射', '合同分账', '差异说明', '报告导出'];

interface StepNavigatorProps {
  currentStep: number;
  onStepChange: (step: number) => void;
}

export default function StepNavigator({ currentStep, onStepChange }: StepNavigatorProps) {
  return (
    <div className="bg-white border-b border-zinc-200 px-6">
      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;
          return (
            <div key={label} className="flex items-center">
              {i > 0 && (
                <div className={`w-12 h-0.5 mx-1 ${i <= currentStep ? 'bg-[#1e3a5f]' : 'bg-zinc-200'}`} />
              )}
              <button
                onClick={() => onStepChange(i)}
                className={`flex items-center gap-2 py-3.5 px-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-[#1e3a5f] border-b-2 border-[#1e3a5f]'
                    : isCompleted
                    ? 'text-[#1e3a5f]/70 hover:text-[#1e3a5f]'
                    : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full text-xs ${
                    isCompleted
                      ? 'bg-[#1e3a5f] text-white'
                      : isActive
                      ? 'bg-[#1e3a5f] text-white'
                      : 'bg-zinc-200 text-zinc-500'
                  }`}
                >
                  {isCompleted ? <Check size={12} /> : i + 1}
                </span>
                {label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
