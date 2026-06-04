import React from 'react';
import { Camera, FileText, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { useCleaningStore } from '@/store/useCleaningStore';

interface StepInfo {
  stepNumber: number;
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  operator: string;
}

const steps: StepInfo[] = [
  {
    stepNumber: 1,
    key: 'import_photo',
    title: '导入工况照片',
    description: '从照片提取主流程数据',
    icon: Camera,
    operator: '业务人员',
  },
  {
    stepNumber: 2,
    key: 'review_note',
    title: '林老师补看巡检备注',
    description: '补充现场说法',
    icon: FileText,
    operator: '林老师',
  },
  {
    stepNumber: 3,
    key: 'unit_conversion',
    title: '单位换算说明更新',
    description: '对齐历史口径',
    icon: RefreshCw,
    operator: '系统自动',
  },
];

export const StepNavigator: React.FC = () => {
  const { workflowStep, setWorkflowStep, conflicts, thresholdAlerts } = useCleaningStore();

  const completedCount = Math.max(0, workflowStep - 1);

  const hasConflictInStep = (stepKey: string) => {
    if (stepKey === 'review_note') {
      return conflicts.some(c => c.resolutionStatus === 'pending');
    }
    if (stepKey === 'unit_conversion') {
      return thresholdAlerts.some(a => a.reviewStatus === 'pending_review');
    }
    return false;
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">数据清洗工作流</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            三步完成证据整合与数据清洗，每一步都有完整证据链记录
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold font-mono text-primary-600">
            {completedCount}
            <span className="text-neutral-400 text-lg">/{steps.length}</span>
          </div>
          <div className="text-xs text-neutral-500">已完成步骤</div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute top-6 left-16 right-16 h-0.5 bg-neutral-200" />
        <div
          className="absolute top-6 left-16 h-0.5 bg-success-500 transition-all duration-500"
          style={{
            width: `${(completedCount / (steps.length - 1)) * (100 - 32)}%`,
          }}
        />

        <div className="flex justify-between relative">
          {steps.map((step) => {
            const isCompleted = workflowStep > step.stepNumber;
            const isCurrent = workflowStep === step.stepNumber;
            const hasConflict = hasConflictInStep(step.key);
            const Icon = step.icon;

            return (
              <button
                key={step.key}
                onClick={() => setWorkflowStep(step.stepNumber)}
                className={`flex flex-col items-center gap-3 relative z-10 group ${
                  isCompleted ? 'cursor-pointer' : isCurrent ? 'cursor-default' : 'cursor-not-allowed opacity-60'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? 'bg-success-500 border-success-500'
                      : isCurrent
                      ? hasConflict
                        ? 'bg-warning-500 border-warning-500 animate-breathing'
                        : 'bg-primary-500 border-primary-500'
                      : 'bg-white border-neutral-300'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-6 h-6 text-white" />
                  ) : hasConflict && isCurrent ? (
                    <AlertTriangle className="w-6 h-6 text-white" />
                  ) : (
                    <Icon
                      className={`w-6 h-6 ${
                        isCurrent ? 'text-white' : 'text-neutral-400 group-hover:text-primary-500'
                      }`}
                    />
                  )}
                </div>

                <div className="text-center">
                  <div
                    className={`font-medium text-sm ${
                      isCurrent ? 'text-primary-700' : 'text-neutral-700'
                    }`}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">{step.description}</div>
                  <div className="text-xs text-neutral-400 mt-1">
                    操作人：<span className="text-neutral-600">{step.operator}</span>
                  </div>
                </div>

                {hasConflict && isCurrent && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-danger-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    !
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
