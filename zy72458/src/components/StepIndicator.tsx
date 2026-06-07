import { STEP_LABELS, ProcessStep } from '../../shared/types';
import { Check, Clock } from 'lucide-react';

interface Props {
  currentStep: ProcessStep;
}

const steps: { step: ProcessStep; label: string }[] = [
  { step: 1, label: '数据导入' },
  { step: 2, label: '补看路口照片' },
  { step: 3, label: '冲突复核表更新' },
];

export default function StepIndicator({ currentStep }: Props) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, idx) => {
        const isCompleted = currentStep > s.step;
        const isCurrent = currentStep === s.step;
        return (
          <div key={s.step} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              isCompleted 
                ? 'bg-green-500 text-white' 
                : isCurrent 
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
                  : 'bg-slate-200 text-slate-500'
            }`}>
              {isCompleted ? <Check size={16} /> : isCurrent ? <Clock size={16} /> : s.step}
            </div>
            <span className={`ml-2 text-sm ${isCurrent ? 'text-blue-600 font-medium' : isCompleted ? 'text-green-600' : 'text-slate-400'}`}>
              {s.label}
            </span>
            {idx < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
