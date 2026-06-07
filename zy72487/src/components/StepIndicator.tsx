import { Check, FileUp, Eye, FileEdit } from 'lucide-react';
import type { RecordStatus } from '@shared/types';

interface StepIndicatorProps {
  status: RecordStatus;
}

const steps = [
  { key: 'import', label: '导入红线图备注', icon: FileUp, statuses: ['pending_review', 'pending_summary', 'completed'] },
  { key: 'review', label: '巡检员复核巡查表', icon: Eye, statuses: ['pending_summary', 'completed'] },
  { key: 'summary', label: '更新街道会看摘要', icon: FileEdit, statuses: ['completed'] },
];

export function StepIndicator({ status }: StepIndicatorProps) {
  const isStepCompleted = (stepStatuses: string[]) => stepStatuses.includes(status);
  const isStepActive = (index: number) => {
    const stepOrder = ['pending_import', 'pending_review', 'pending_summary', 'completed'];
    const currentIdx = stepOrder.indexOf(status);
    return currentIdx === index + 1;
  };

  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, index) => {
        const completed = isStepCompleted(step.statuses);
        const active = isStepActive(index);

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  completed
                    ? 'bg-success-500 border-success-500 text-white'
                    : active
                    ? 'bg-municipal-50 border-municipal-500 text-municipal-700'
                    : 'bg-slate-50 border-slate-300 text-slate-400'
                }`}
              >
                {completed ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <step.icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium ${
                  completed
                    ? 'text-success-700'
                    : active
                    ? 'text-municipal-700'
                    : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  isStepCompleted(steps[index + 1].statuses)
                    ? 'bg-success-500'
                    : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
