import { Check, ChevronRight } from 'lucide-react';
import type { WorkflowStepInfo } from '../../shared/types';
import { cn } from '../lib/utils';

interface WorkflowStepperProps {
  steps: WorkflowStepInfo[];
  onAdvance?: () => void;
  canAdvance?: boolean;
  loading?: boolean;
}

export function WorkflowStepper({ steps, onAdvance, canAdvance = true, loading = false }: WorkflowStepperProps) {
  return (
    <div className="bg-slate-900 rounded-lg p-6 shadow-lg border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">处理流程</h3>
        {onAdvance && (
          <button
            onClick={onAdvance}
            disabled={!canAdvance || loading}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-sm font-medium transition-all',
              canAdvance && !loading
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
            )}
          >
            {loading ? (
              <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            推进到下一步
          </button>
        )}
      </div>
      
      <div className="relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-700">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${((steps.filter(s => s.status === 'completed').length) / (steps.length - 1)) * 100}%` }}
          />
        </div>
        
        <div className="relative flex justify-between">
          {steps.map((step, index) => (
            <div key={step.step} className="flex flex-col items-center">
              <div
                className={cn(
                  'relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 font-semibold text-sm transition-all duration-300',
                  step.status === 'completed'
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : step.status === 'current'
                    ? 'bg-amber-500 border-amber-500 text-white ring-4 ring-amber-500/20'
                    : 'bg-slate-800 border-slate-600 text-slate-400'
                )}
              >
                {step.status === 'completed' ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.step
                )}
              </div>
              <div className="mt-3 text-center max-w-[120px]">
                <div className={cn(
                  'text-sm font-medium',
                  step.status === 'completed' ? 'text-emerald-400' :
                  step.status === 'current' ? 'text-amber-400' : 'text-slate-400'
                )}>
                  {step.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {step.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
