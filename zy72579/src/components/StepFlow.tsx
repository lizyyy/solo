import { Check, AlertTriangle, Clock } from 'lucide-react';
import type { StepStatus } from '@/types';

interface StepFlowProps {
  steps: StepStatus[];
}

export function StepFlow({ steps }: StepFlowProps) {
  const getStepIcon = (status: StepStatus['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="w-5 h-5 text-white" />;
      case 'current':
        return <span className="w-3 h-3 bg-white rounded-full" />;
      case 'blocked':
        return <AlertTriangle className="w-5 h-5 text-white" />;
      case 'pending':
      default:
        return <Clock className="w-5 h-5 text-white/60" />;
    }
  };

  const getStepBgClass = (status: StepStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-600 border-emerald-700';
      case 'current':
        return 'bg-teal-600 border-teal-700 ring-4 ring-teal-100';
      case 'blocked':
        return 'bg-amber-600 border-amber-700';
      case 'pending':
      default:
        return 'bg-slate-300 border-slate-400';
    }
  };

  const getLineClass = (index: number) => {
    const currentStep = steps.findIndex((s) => s.status !== 'completed' && s.status !== 'pending');
    const isPast = index < currentStep;
    return isPast ? 'bg-emerald-500' : 'bg-slate-200';
  };

  return (
    <div className="bg-white border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-6 font-serif">审核流程进度</h3>
      <div className="flex items-start">
        {steps.map((step, index) => (
          <div key={step.key} className="flex-1 relative">
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${getStepBgClass(step.status)}`}
              >
                {getStepIcon(step.status)}
              </div>
              <div className="mt-3 text-center">
                <p className={`text-sm font-medium ${step.status === 'pending' ? 'text-slate-400' : 'text-slate-900'}`}>
                  {step.label}
                </p>
                {step.blockedReason && (
                  <p className="mt-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 border border-amber-200">
                    {step.blockedReason}
                  </p>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`absolute top-6 left-1/2 w-full h-0.5 -translate-y-1/2 ${getLineClass(index)}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
