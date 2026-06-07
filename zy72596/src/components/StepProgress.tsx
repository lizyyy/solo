import { Check } from 'lucide-react';
import { ReviewStep, STEP_LABELS } from '@/types';

interface StepProgressProps {
  currentStep: ReviewStep;
  onAdvance?: () => void;
  canAdvance?: boolean;
}

const steps: ReviewStep[] = ['log_import', 'threshold_note', 'summary_update'];

export function StepProgress({ currentStep, onAdvance, canAdvance = true }: StepProgressProps) {
  const currentIdx = steps.indexOf(currentStep);

  return (
    <div className="flex items-center justify-between w-full max-w-3xl mx-auto">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isCompleted
                    ? 'bg-green-600 border-green-600 text-white'
                    : isCurrent
                    ? 'bg-primary-800 border-primary-800 text-white'
                    : 'bg-white border-primary-200 text-primary-400'
                }`}
              >
                {isCompleted ? (
                  <Check size={18} />
                ) : (
                  <span className="text-sm font-semibold">{idx + 1}</span>
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium ${
                  isCurrent ? 'text-primary-800' : isCompleted ? 'text-green-600' : 'text-primary-400'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 -mt-6 transition-all duration-300 ${
                  idx < currentIdx ? 'bg-green-500' : 'bg-primary-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
