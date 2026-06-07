import { Upload, Users, FileCheck, Check } from 'lucide-react';
import type { ProcessStep } from '@/types';

interface ProcessStepperProps {
  currentStep: ProcessStep;
  hasMissingRegion?: boolean;
}

const steps = [
  {
    id: 'import',
    label: '调音师留言导入',
    icon: Upload,
    description: '第一步：导入初始数据'
  },
  {
    id: 'review_jietlong',
    label: '巡演统筹补看接龙',
    icon: Users,
    description: '第二步：核对排练群信息'
  },
  {
    id: 'update_verification',
    label: '课时核销单更新',
    icon: FileCheck,
    description: '第三步：生成核销单'
  }
];

export function ProcessStepper({ currentStep, hasMissingRegion }: ProcessStepperProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-6">流程进度</h3>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLocked = hasMissingRegion && index > 0;
          
          return (
            <div key={step.id} className="flex-1 relative">
              <div className="flex flex-col items-center">
                <div 
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center mb-3
                    transition-all duration-300
                    ${isCompleted ? 'bg-emerald-500 text-white' : ''}
                    ${isCurrent && !isLocked ? 'bg-blue-600 text-white ring-4 ring-blue-100' : ''}
                    ${!isCompleted && !isCurrent ? 'bg-slate-100 text-slate-400' : ''}
                    ${isLocked ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : ''}
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <StepIcon className="w-5 h-5" />
                  )}
                </div>
                <span className={`text-sm font-medium ${isCurrent && !isLocked ? 'text-blue-700' : isCompleted ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {step.label}
                </span>
                <span className="text-xs text-slate-400 mt-1">{step.description}</span>
                {isLocked && (
                  <span className="text-xs text-amber-600 mt-1 font-medium">待店长复核</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div 
                  className={`
                    absolute top-6 left-1/2 w-full h-0.5
                    ${isCompleted ? 'bg-emerald-500' : 'bg-slate-200'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
