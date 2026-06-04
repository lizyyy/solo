import { Check, Clock, AlertTriangle } from 'lucide-react';
import type { WorkflowState } from '../types';
import { getStepName } from '../utils/exponentialSmoothing';
import { useForecastStore } from '../store/forecastStore';

interface Props {
  workflowState: WorkflowState | null;
  loading?: boolean;
}

export default function WorkflowStepper({ workflowState, loading = false }: Props) {
  const { conflicts } = useForecastStore();
  const hasUnresolvedConflicts = conflicts.some(c => c.status === 'pending');

  const currentStep = workflowState?.currentStep ?? 0;
  const step1Completed = workflowState?.step1Completed ?? false;
  const step2Completed = workflowState?.step2Completed ?? false;
  const step3Completed = workflowState?.step3Completed ?? false;

  const steps = [
    {
      step: 1,
      name: getStepName(1),
      completed: step1Completed,
      isCurrent: currentStep === 1,
      showWarning: false,
    },
    {
      step: 2,
      name: getStepName(2),
      completed: step2Completed,
      isCurrent: currentStep === 2,
      showWarning: hasUnresolvedConflicts,
    },
    {
      step: 3,
      name: getStepName(3),
      completed: step3Completed,
      isCurrent: currentStep === 3,
      showWarning: false,
    },
  ];

  const getStepIcon = (stepData: typeof steps[0]) => {
    if (stepData.showWarning && !stepData.completed) {
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    }
    if (stepData.completed) {
      return <Check className="w-5 h-5 text-white" />;
    }
    return <Clock className="w-5 h-5 text-gray-400" />;
  };

  const getStepCircleClass = (stepData: typeof steps[0]) => {
    const baseClass = 'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300';
    
    if (stepData.completed) {
      return `${baseClass} bg-blue-500`;
    }
    if (stepData.isCurrent) {
      return `${baseClass} border-2 border-blue-500 bg-white`;
    }
    return `${baseClass} bg-gray-100 border-2 border-gray-200`;
  };

  const getConnectorClass = (index: number) => {
    const prevCompleted = steps[index].completed;
    return `h-0.5 flex-1 transition-colors duration-300 ${
      prevCompleted ? 'bg-blue-500' : 'bg-gray-200'
    }`;
  };

  return (
    <div className="w-full px-4 py-6">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        {steps.map((stepData, index) => (
          <div key={stepData.step} className="flex items-center flex-1">
            <div className="flex flex-col items-center relative">
              <div className="relative">
                {stepData.isCurrent && !loading && (
                  <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
                )}
                <div className={getStepCircleClass(stepData)}>
                  {getStepIcon(stepData)}
                </div>
              </div>
              <div className="mt-2 text-center">
                <p
                  className={`text-sm font-medium transition-colors duration-300 ${
                    stepData.isCurrent
                      ? 'text-blue-600'
                      : stepData.completed
                      ? 'text-gray-700'
                      : 'text-gray-400'
                  }`}
                >
                  步骤 {stepData.step}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={getConnectorClass(index)} />
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              处理中...
            </span>
          ) : currentStep > 0 ? (
            <span>
              当前进度：<span className="font-semibold text-blue-600">{getStepName(currentStep)}</span>
            </span>
          ) : (
            '工作流未开始'
          )}
        </p>
        {steps[1].showWarning && !steps[1].completed && (
          <p className="mt-1 text-sm text-amber-600 flex items-center justify-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            步骤2存在未解决的冲突，请及时处理
          </p>
        )}
      </div>
    </div>
  );
}
