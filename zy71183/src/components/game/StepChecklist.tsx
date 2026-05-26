import { CheckCircle2, Circle, XCircle, AlertCircle, ChevronRight } from 'lucide-react';
import type { InspectionPoint, StepStatus } from '../../types';

interface StepChecklistProps {
  points: InspectionPoint[];
  requiredOrder: string[];
  currentStep: number;
  completedSteps: string[];
  wrongSteps: string[];
  skippedSteps: string[];
}

export function StepChecklist({
  points,
  requiredOrder,
  currentStep,
  completedSteps,
  wrongSteps,
  skippedSteps,
}: StepChecklistProps) {
  const getStepStatus = (pointId: string, index: number): StepStatus => {
    if (completedSteps.includes(pointId)) return 'completed';
    if (wrongSteps.includes(pointId)) return 'wrong';
    if (skippedSteps.includes(pointId)) return 'skipped';
    if (index === currentStep) return 'current';
    return 'pending';
  };

  const getStepStyle = (status: StepStatus) => {
    const base = 'flex items-center gap-3 p-3 rounded-lg transition-all duration-200';
    
    switch (status) {
      case 'completed':
        return `${base} bg-green-900/30 border border-green-700`;
      case 'current':
        return `${base} bg-industrial-blue/20 border border-industrial-blue glow-blue`;
      case 'wrong':
        return `${base} bg-industrial-red/30 border border-industrial-red`;
      case 'skipped':
        return `${base} bg-slate-800/50 border border-slate-600 opacity-50`;
      default:
        return `${base} bg-slate-800/30 border border-slate-700`;
    }
  };

  const getStepIcon = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'wrong':
        return <XCircle className="w-5 h-5 text-industrial-red" />;
      case 'skipped':
        return <AlertCircle className="w-5 h-5 text-slate-500" />;
      case 'current':
        return <ChevronRight className="w-5 h-5 text-industrial-blue animate-pulse" />;
      default:
        return <Circle className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 h-full">
      <h2 className="text-lg font-semibold text-white mb-4">巡检步骤清单</h2>
      
      <div className="space-y-2 overflow-y-auto max-h-96 scrollbar-thin">
        {requiredOrder.map((pointId, index) => {
          const point = points.find(p => p.id === pointId);
          if (!point) return null;
          
          const status = getStepStatus(pointId, index);
          
          return (
            <div
              key={pointId}
              className={getStepStyle(status)}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                status === 'completed' ? 'bg-green-600 text-white' :
                status === 'current' ? 'bg-industrial-blue text-white' :
                status === 'wrong' ? 'bg-industrial-red text-white' :
                'bg-slate-700 text-slate-400'
              }`}>
                {index + 1}
              </span>
              
              {getStepIcon(status)}
              
              <div className="flex-1">
                <p className={`font-medium ${
                  status === 'completed' ? 'text-green-400' :
                  status === 'wrong' ? 'text-industrial-red' :
                  status === 'current' ? 'text-white' :
                  'text-slate-400'
                }`}>
                  {point.name}
                </p>
                <p className="text-xs text-slate-500">{point.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
