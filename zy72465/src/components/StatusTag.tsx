import type { RecordStatus, StepNumber, Credibility } from '@/types';
import { STATUS_LABELS, STEP_LABELS, CREDIBILITY_LABELS } from '@/types';

interface StatusTagProps {
  status: RecordStatus;
}

export function StatusTag({ status }: StatusTagProps) {
  const styles: Record<RecordStatus, string> = {
    imported: 'bg-gray-100 text-gray-700 border-gray-200',
    pending_review: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
    sampling_reviewed: 'bg-blue-50 text-blue-700 border-blue-200',
    summary_updated: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    inspector_confirmed: 'bg-teal-50 text-teal-700 border-teal-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${styles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

interface StepProgressProps {
  currentStep: StepNumber;
}

export function StepProgress({ currentStep }: StepProgressProps) {
  const steps: StepNumber[] = [1, 2, 3];

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, idx) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;
        
        return (
          <div key={step} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
              isCompleted 
                ? 'bg-green-50 text-green-700' 
                : isCurrent 
                  ? 'bg-blue-50 text-blue-700 font-medium ring-2 ring-blue-200' 
                  : 'bg-gray-100 text-gray-400'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                isCompleted 
                  ? 'bg-green-500 text-white' 
                  : isCurrent 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-300 text-gray-500'
              }`}>
                {isCompleted ? '✓' : step}
              </span>
              <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${
                isCompleted ? 'bg-green-300' : 'bg-gray-200'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface CredibilityTagProps {
  credibility: Credibility;
}

export function CredibilityTag({ credibility }: CredibilityTagProps) {
  const styles: Record<Credibility, string> = {
    high: 'bg-green-50 text-green-700 border-green-200',
    medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    low: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[credibility]}`}>
      可信度{CREDIBILITY_LABELS[credibility]}
    </span>
  );
}

interface NameConflictTagProps {
  hasConflict: boolean;
}

export function NameConflictTag({ hasConflict }: NameConflictTagProps) {
  if (!hasConflict) return null;
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">
      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
      新旧名称待复核
    </span>
  );
}
