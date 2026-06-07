import { Check, FileText, ClipboardList, RefreshCw } from 'lucide-react';
import { ReviewStep, REVIEW_STEP_LABELS } from '../../types';

interface StepProgressProps {
  currentStep: ReviewStep;
}

const StepProgress = ({ currentStep }: StepProgressProps) => {
  const steps: { key: ReviewStep; label: string; icon: typeof FileText }[] = [
    { key: 'step1', label: REVIEW_STEP_LABELS.step1, icon: FileText },
    { key: 'step2', label: REVIEW_STEP_LABELS.step2, icon: ClipboardList },
    { key: 'step3', label: REVIEW_STEP_LABELS.step3, icon: RefreshCw },
  ];
  
  const stepOrder: ReviewStep[] = ['step1', 'step2', 'step3'];
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="card-border mb-6">
      <h3 className="text-sm font-semibold text-primary-800 mb-4">复核流程进度</h3>
      <div className="flex items-center">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.key} className="flex-1 relative">
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-500 ${
                  isCompleted 
                    ? 'bg-green-500 text-white shadow-lg shadow-green-200' 
                    : isCurrent 
                      ? 'bg-accent-400 text-primary-900 shadow-lg shadow-accent-200 animate-pulse-glow' 
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {isCompleted ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  isCompleted || isCurrent ? 'text-primary-800' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
                <span className={`text-xs mt-1 ${
                  isCurrent ? 'text-accent-600 font-medium' : 'text-gray-400'
                }`}>
                  {isCurrent ? '当前步骤' : isCompleted ? '已完成' : '未开始'}
                </span>
              </div>
              
              {!isLast && (
                <div className="absolute top-6 left-1/2 w-full h-0.5 -translate-y-1/2">
                  <div className={`h-full transition-all duration-500 ${
                    index < currentIndex ? 'bg-green-500 w-full' : 'bg-gray-200 w-full'
                  }`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepProgress;
