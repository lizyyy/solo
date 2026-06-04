import { Check, Clock, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { ProcessStep, ProcessStatus } from '../types';

const steps: { key: ProcessStep; label: string; description: string }[] = [
  {
    key: 'threshold_import',
    label: '第一步：导入安全阈值表',
    description: '数据分析员导入安全阈值表，系统检测与铭牌参数冲突',
  },
  {
    key: 'nameplate_review',
    label: '第二步：何工补看设备铭牌参数',
    description: '设备工程师何工查看设备铭牌，处理冲突，补录旧口径',
  },
  {
    key: 'conversion_update',
    label: '第三步：更新单位换算说明',
    description: '根据决策结果更新单位换算，标注参数版本和取舍理由',
  },
];

const statusConfig: Record<ProcessStatus, { icon: typeof Check; color: string; bgColor: string }> = {
  completed: {
    icon: Check,
    color: 'text-[#27ae60]',
    bgColor: 'bg-[#27ae60]/10 border-[#27ae60]',
  },
  in_progress: {
    icon: Clock,
    color: 'text-[#f39c12]',
    bgColor: 'bg-[#f39c12]/10 border-[#f39c12]',
  },
  pending: {
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-800/50 border-gray-600',
  },
};

export default function ProcessTimeline() {
  const processState = useAppStore((s) => s.processState);

  return (
    <div className="bg-[#0f2744] border border-[#2d5a87] rounded-sm p-6 mb-8">
      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
        <span className="w-1 h-5 bg-[#5dade2] mr-3"></span>
        业务流程进度
      </h3>

      <div className="relative">
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-[#2d5a87] mx-8">
          <div
            className="h-full bg-gradient-to-r from-[#5dade2] to-[#27ae60] transition-all duration-500"
            style={{
              width: `${
                processState.steps.threshold_import === 'completed'
                  ? processState.steps.nameplate_review === 'completed'
                    ? '100%'
                    : '50%'
                  : '0%'
              }`,
            }}
          />
        </div>

        <div className="relative grid grid-cols-3 gap-4">
          {steps.map((step, index) => {
            const status = processState.steps[step.key];
            const config = statusConfig[status];
            const Icon = config.icon;
            const isCurrent = processState.currentStep === step.key;

            return (
              <div key={step.key} className="relative">
                <div
                  className={`
                    flex flex-col items-center
                    transition-all duration-300
                    ${isCurrent ? 'scale-105' : ''}
                  `}
                >
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center
                      border-2 ${config.bgColor} ${config.color}
                      transition-all duration-300
                      ${isCurrent ? 'ring-4 ring-[#5dade2]/30 animate-pulse' : ''}
                    `}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="mt-4 text-center">
                    <h4
                      className={`
                        font-bold text-sm mb-1
                        ${status === 'completed' ? 'text-[#27ae60]' : ''}
                        ${status === 'in_progress' ? 'text-[#f39c12]' : ''}
                        ${status === 'pending' ? 'text-gray-500' : ''}
                        ${isCurrent ? 'text-white' : ''}
                      `}
                    >
                      {step.label}
                    </h4>
                    <p className="text-xs text-gray-400 max-w-xs">
                      {step.description}
                    </p>
                  </div>
                </div>

                {index < steps.length - 1 && (
                  <div className="absolute top-6 right-0 transform translate-x-1/2">
                    <ArrowRight
                      className={`
                        w-4 h-4
                        ${status === 'completed' ? 'text-[#27ae60]' : 'text-gray-600'}
                      `}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-[#2d5a87] grid grid-cols-3 gap-4 text-sm">
        <div className="flex items-center justify-center space-x-2">
          <div
            className={`
              w-3 h-3 rounded-sm
              ${processState.thresholdImported ? 'bg-[#27ae60]' : 'bg-gray-600'}
            `}
          />
          <span className="text-gray-400">
            阈值表已导入：{processState.thresholdImported ? '是' : '否'}
          </span>
        </div>
        <div className="flex items-center justify-center space-x-2">
          <div
            className={`
              w-3 h-3 rounded-sm
              ${processState.nameplateReviewedByHe ? 'bg-[#27ae60]' : 'bg-[#f39c12]'}
            `}
          />
          <span className="text-gray-400">
            何工已复核铭牌：{processState.nameplateReviewedByHe ? '是' : '否'}
          </span>
        </div>
        <div className="flex items-center justify-center space-x-2">
          <div
            className={`
              w-3 h-3 rounded-sm
              ${processState.conversionUpdated ? 'bg-[#27ae60]' : 'bg-gray-600'}
            `}
          />
          <span className="text-gray-400">
            换算说明已更新：{processState.conversionUpdated ? '是' : '否'}
          </span>
        </div>
      </div>
    </div>
  );
}
