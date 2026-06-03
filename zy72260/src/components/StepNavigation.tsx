import { motion } from 'framer-motion';
import { Check, FileInput, Shield, Download } from 'lucide-react';
import { WorkflowStep } from '@/types';
import { cn } from '@/lib/utils';

interface StepNavigationProps {
  currentStep: WorkflowStep;
  stepCompleted: Record<WorkflowStep, boolean>;
  onStepClick: (step: WorkflowStep) => void;
  pendingConflicts: number;
  pendingReviews: number;
}

const steps: Array<{
  key: WorkflowStep;
  label: string;
  description: string;
  icon: typeof FileInput;
}> = [
  {
    key: 'import_point_cloud',
    label: '第一步',
    description: '导入点云抽稀日志',
    icon: FileInput,
  },
  {
    key: 'import_safety_radius',
    label: '第二步',
    description: '补看安全半径表',
    icon: Shield,
  },
  {
    key: 'export',
    label: '第三步',
    description: '导出截图',
    icon: Download,
  },
];

export default function StepNavigation({
  currentStep,
  stepCompleted,
  onStepClick,
  pendingConflicts,
  pendingReviews,
}: StepNavigationProps) {
  const getStepStatus = (step: WorkflowStep) => {
    if (stepCompleted[step]) return 'completed';
    if (currentStep === step) return 'active';
    return 'pending';
  };

  const getBadgeCount = (step: WorkflowStep) => {
    if (step === 'import_safety_radius' && pendingConflicts > 0) {
      return pendingConflicts;
    }
    if (step === 'export' && (pendingConflicts > 0 || pendingReviews > 0)) {
      return pendingConflicts + pendingReviews;
    }
    return 0;
  };

  return (
    <div className="bg-white border-r border-gray-200 w-64 p-6 flex flex-col h-full">
      <div className="mb-8">
        <h1 className="text-lg font-bold text-gray-800 mb-1">
          博物馆展柜动线模拟
        </h1>
        <p className="text-xs text-gray-500">
          航测内业 · 安全半径复核工具
        </p>
      </div>

      <div className="flex-1 space-y-4">
        {steps.map((step, idx) => {
          const status = getStepStatus(step.key);
          const badgeCount = getBadgeCount(step.key);
          const Icon = step.icon;
          const isClickable = status === 'completed' || 
            (idx === 0) || 
            (idx > 0 && stepCompleted[steps[idx - 1].key]);

          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                'relative p-4 rounded-lg border-2 transition-all',
                isClickable ? 'cursor-pointer hover:shadow-md' : 'opacity-50 cursor-not-allowed',
                status === 'active' && 'step-active shadow-lg shadow-survey-200',
                status === 'completed' && 'step-completed',
                status === 'pending' && 'step-pending'
              )}
              onClick={() => isClickable && onStepClick(step.key)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-white/20">
                  {status === 'completed' ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{step.label}</span>
                    {badgeCount > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-danger-500 text-white">
                        {badgeCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-80 mt-1">{step.description}</p>
                </div>
              </div>

              {status === 'active' && (
                <motion.div
                  layoutId="activeStepIndicator"
                  className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-full"
                />
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500 space-y-1">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success-500" />
            待处理冲突：{pendingConflicts} 项
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning-500" />
            待客户复核：{pendingReviews} 项
          </p>
        </div>
      </div>
    </div>
  );
}
