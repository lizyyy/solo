import { Check, ChevronRight } from 'lucide-react';
import type { StepStatus, StepInfo } from '../types';

interface StepProgressProps {
  steps: StepInfo[];
}

const getStepClass = (status: StepStatus): string => {
  switch (status) {
    case 'completed':
      return 'step-completed';
    case 'active':
      return 'step-active';
    case 'pending':
      return 'step-pending';
  }
};

export function StepProgress({ steps }: StepProgressProps) {
  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, index) => (
        <div key={step.step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${getStepClass(step.status)}`}
            >
              {step.status === 'completed' ? (
                <Check className="w-5 h-5" />
              ) : (
                <span>{step.step}</span>
              )}
            </div>
            <div className="mt-2 text-center">
              <p
                className={`text-sm font-medium ${step.status === 'pending' ? 'text-industrial-400' : 'text-industrial-800'}`}
              >
                {step.title}
              </p>
              <p
                className={`text-xs mt-1 ${step.status === 'pending' ? 'text-industrial-300' : 'text-industrial-500'}`}
              >
                {step.description}
              </p>
            </div>
          </div>
          {index < steps.length - 1 && (
            <div className="mx-4">
              <ChevronRight
                className={`w-6 h-6 ${step.status === 'completed' ? 'text-emerald-500' : 'text-industrial-300'}`}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
