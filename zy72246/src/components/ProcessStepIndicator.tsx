import { Check, ChevronRight } from 'lucide-react';
import { ProcessStep } from '@/types';
import { getStepDisplayName } from '@/utils/stateMachine';

interface ProcessStepIndicatorProps {
  currentStep: ProcessStep;
  className?: string;
}

const steps = [
  ProcessStep.STEP_1_IMPORT,
  ProcessStep.STEP_2_SUPPLEMENT,
  ProcessStep.STEP_4_SUMMARY,
];

export function ProcessStepIndicator({ currentStep, className = '' }: ProcessStepIndicatorProps) {
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className={`flex items-center ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-all ${
                isCompleted
                  ? 'bg-green-600 text-white'
                  : isCurrent
                  ? 'bg-blue-600 text-white ring-2 ring-blue-200'
                  : 'bg-gray-200 text-gray-500'
              }`}
              title={getStepDisplayName(step)}
            >
              {isCompleted ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            {index < steps.length - 1 && (
              <ChevronRight
                className={`w-4 h-4 mx-0.5 ${
                  isCompleted ? 'text-green-400' : 'text-gray-300'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
