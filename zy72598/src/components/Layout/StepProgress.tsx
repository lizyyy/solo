import { Check, FileUp, Edit3, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepProgressProps {
  currentStep: 1 | 2 | 3;
  completed?: boolean;
}

const steps = [
  { step: 1, label: '导入训练日志', icon: FileUp },
  { step: 2, label: '补看调参笔记', icon: Edit3 },
  { step: 3, label: '生成可解释摘要', icon: FileText },
];

export const StepProgress = ({ currentStep, completed = false }: StepProgressProps) => {
  return (
    <div className="flex items-center justify-between w-full max-w-3xl mx-auto">
      {steps.map((step, index) => {
        const isCompleted = completed || step.step < currentStep;
        const isCurrent = step.step === currentStep && !completed;

        return (
          <div key={step.step} className="flex items-center flex-1">
            <div className="flex flex-col items-center relative flex-1">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10',
                  isCompleted
                    ? 'bg-green-500 border-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-white border-gray-300 text-gray-400'
                )}
              >
                {isCompleted ? (
                  <Check className="w-6 h-6" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
              </div>
              <p
                className={cn(
                  'mt-2 text-sm font-medium text-center',
                  isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'
                )}
              >
                {step.label}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-1 flex-1 mx-2 mb-6 rounded-full transition-all duration-300',
                  step.step < currentStep || completed ? 'bg-green-500' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
