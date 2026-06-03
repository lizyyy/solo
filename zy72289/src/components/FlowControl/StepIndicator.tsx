import { motion } from 'framer-motion';
import { FileText, Search, Eye, CheckCircle } from 'lucide-react';
import type { CurrentStep } from '@/types';

interface StepIndicatorProps {
  currentStep: CurrentStep;
}

const steps = [
  {
    number: 1,
    title: '导入日志',
    description: '点云抽稀日志导入',
    icon: FileText,
  },
  {
    number: 2,
    title: '核对半径表',
    description: '对照安全半径表',
    icon: Search,
  },
  {
    number: 3,
    title: '更新标注',
    description: '三维标注视图更新',
    icon: Eye,
  },
];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const IconComponent = step.icon;
        const isActive = currentStep === step.number;
        const isCompleted = currentStep > step.number;

        return (
          <div key={step.number} className="flex items-center">
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-2"
            >
              <div
                className={`
                  relative flex items-center justify-center
                  w-10 h-10 rounded-full border-2 transition-all duration-300
                  ${isActive
                    ? 'border-primary-400 bg-primary-600 scale-110 shadow-lg shadow-primary-500/30'
                    : isCompleted
                      ? 'border-status-normal bg-status-normal/20'
                      : 'border-primary-700 bg-primary-800/50'
                  }
                `}
              >
                {isCompleted ? (
                  <CheckCircle size={18} className="text-status-normal" />
                ) : (
                  <>
                    <IconComponent
                      size={18}
                      className={isActive ? 'text-white' : 'text-gray-500'}
                    />
                    {isActive && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 rounded-full border-2 border-primary-400"
                      />
                    )}
                  </>
                )}
              </div>
              <div className="hidden sm:block">
                <p
                  className={`text-xs font-semibold ${
                    isActive || isCompleted ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-[9px] text-gray-500">{step.description}</p>
              </div>
            </motion.div>

            {index < steps.length - 1 && (
              <div className="relative w-8 sm:w-16 h-0.5 mx-1 sm:mx-2">
                <div className="absolute inset-0 bg-primary-700/50" />
                {isCompleted && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-y-0 left-0 bg-status-normal"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
