import { WorkflowStep, STEP_LABELS } from '@/types';
import { Check, ChevronRight } from 'lucide-react';
import { useRecordsStore } from '@/store/useRecordsStore';

const STEPS = [WorkflowStep.IMPORT, WorkflowStep.BUS_CHECK, WorkflowStep.SUMMARY];

export function StepNavigator() {
  const { currentStep, setCurrentStep } = useRecordsStore();

  const getStepIndex = (step: WorkflowStep) => STEPS.indexOf(step);
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">轨交站口雨棚排查</h1>
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => {
              const isCompleted = index < currentIndex;
              const isActive = index === currentIndex;
              return (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : isCompleted
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                    )}
                    <span className="text-sm font-medium">{STEP_LABELS[step]}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <ChevronRight className="w-5 h-5 text-slate-300 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
