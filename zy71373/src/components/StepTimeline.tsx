import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { AuditStep } from '../types';

interface StepTimelineProps {
  steps: AuditStep[];
  currentStep: number;
}

const stepOrder = ['upload', 'recognize', 'match', 'validate', 'analyze', 'report'];

export function StepTimeline({ steps, currentStep }: StepTimelineProps) {
  return (
    <div className="flex items-center justify-between w-full">
      {stepOrder.map((stepType, index) => {
        const step = steps.find(s => s.type === stepType);
        const isActive = index === currentStep;
        const isCompleted = index < currentStep || (step && step.status === 'completed');
        const isRunning = step?.status === 'running';

        const stepNames: Record<string, string> = {
          upload: '文件上传',
          recognize: '字体识别',
          match: '授权匹配',
          validate: '渠道校验',
          analyze: '风险分析',
          report: '生成报告'
        };

        return (
          <div key={stepType} className="flex-1 flex flex-col items-center relative">
            {index < stepOrder.length - 1 && (
              <div
                className={`absolute top-4 left-1/2 w-full h-0.5 transition-colors duration-500 ${
                  isCompleted ? 'bg-[#43A047]' : 'bg-slate-600'
                }`}
              />
            )}
            <div
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                isCompleted
                  ? 'bg-[#43A047] text-white'
                  : isActive || isRunning
                  ? 'bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isRunning ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Circle className="w-5 h-5" />
              )}
            </div>
            <span
              className={`mt-2 text-xs font-medium text-center transition-colors duration-300 ${
                isCompleted || isActive ? 'text-slate-200' : 'text-slate-500'
              }`}
            >
              {stepNames[stepType]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
