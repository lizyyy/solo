import { Check, FileText, Eye, FileCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface StepProgressProps {
  currentStep: number;
  hasConflict?: boolean;
  isManagerReview?: boolean;
}

const steps = [
  { id: 1, label: '导入合同页截图', icon: FileText },
  { id: 2, label: '补看曲目别名表', icon: Eye },
  { id: 3, label: '更新课时核销单', icon: FileCheck },
];

export function StepProgress({
  currentStep,
  hasConflict = false,
  isManagerReview = false,
}: StepProgressProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
      <h3 className="text-sm font-medium text-gray-500 mb-6">处理进度</h3>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const StepIcon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300',
                    isCompleted && 'bg-emerald-500 text-white',
                    isCurrent && !isManagerReview && 'bg-slate-700 text-white',
                    isCurrent && isManagerReview && 'bg-amber-500 text-white animate-pulse',
                    !isCompleted && !isCurrent && 'bg-gray-100 text-gray-400',
                    isCurrent && hasConflict && step.id === 2 && 'bg-red-500 text-white'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <StepIcon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={cn(
                    'mt-3 text-sm font-medium transition-colors',
                    isCompleted && 'text-emerald-600',
                    isCurrent && !isManagerReview && 'text-slate-700',
                    isCurrent && isManagerReview && 'text-amber-600',
                    !isCompleted && !isCurrent && 'text-gray-400'
                  )}
                >
                  {step.label}
                </span>
                {isCurrent && isManagerReview && (
                  <span className="mt-1 text-xs text-amber-600 font-medium">
                    待店长复核
                  </span>
                )}
                {isCurrent && hasConflict && step.id === 2 && (
                  <span className="mt-1 text-xs text-red-600 font-medium">
                    检测到口径冲突
                  </span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 mb-8 transition-colors duration-300',
                    isCompleted ? 'bg-emerald-500' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
