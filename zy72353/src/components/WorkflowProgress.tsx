import { Check, ChevronRight, FileInput, Wrench, UserCheck, FileText } from 'lucide-react';
import type { WorkflowStep } from '../types';
import { cn } from '../lib/utils';

interface WorkflowProgressProps {
  currentStep: WorkflowStep;
  onStepClick?: (step: WorkflowStep) => void;
}

const steps: { key: WorkflowStep; label: string; icon: any; description: string }[] = [
  { key: 'import', label: '数据导入', icon: FileInput, description: '安全阈值表第一次导入' },
  { key: 'engineer_review', label: '工程师复核', icon: Wrench, description: '设备工程师补看设备铭牌参数' },
  { key: 'coach_review', label: '教练审核', icon: UserCheck, description: '训练教练复核单位混用' },
  { key: 'report', label: '报告生成', icon: FileText, description: '交接报告更新' },
];

const WorkflowProgress = ({ currentStep, onStepClick }: WorkflowProgressProps) => {
  const getStepStatus = (stepKey: WorkflowStep) => {
    const currentIndex = steps.findIndex((s) => s.key === currentStep);
    const stepIndex = steps.findIndex((s) => s.key === stepKey);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="bg-industrial-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(step.key);
          const Icon = step.icon;
          const isClickable = status === 'completed' || status === 'current';

          return (
            <div key={step.key} className="flex-1 relative">
              <div
                className={cn(
                  "flex flex-col items-center transition-all",
                  isClickable && onStepClick ? "cursor-pointer hover:opacity-80" : ""
                )}
                onClick={() => isClickable && onStepClick?.(step.key)}
              >
                <div
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-all",
                    status === 'completed' && "bg-success-500 text-white shadow-lg shadow-success-500/30",
                    status === 'current' && "bg-primary-500 text-white shadow-lg shadow-primary-500/30 animate-glow",
                    status === 'pending' && "bg-industrial-600 text-industrial-400"
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="w-7 h-7" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </div>
                <p
                  className={cn(
                    "font-medium text-sm mb-1",
                    status === 'pending' ? "text-industrial-400" : "text-white"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-industrial-400 text-xs text-center max-w-32">
                  {step.description}
                </p>
              </div>

              {index < steps.length - 1 && (
                <div className="absolute top-7 left-1/2 w-full h-0.5 -translate-y-1/2">
                  <div
                    className={cn(
                      "h-full transition-all",
                      status === 'completed' ? "bg-success-500" : "bg-industrial-500"
                    )}
                    style={{ width: status === 'completed' ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowProgress;
