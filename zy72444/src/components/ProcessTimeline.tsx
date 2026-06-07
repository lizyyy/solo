import { Check, Upload, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import type { ProcessStep } from '@/types';
import { formatDateTime } from '@/utils';

interface ProcessTimelineProps {
  processStep: ProcessStep;
}

export default function ProcessTimeline({ processStep }: ProcessTimelineProps) {
  const steps = [
    {
      step: 1,
      title: '导入课时签到照片',
      description: '版权运营小鹿上传签到照片，系统自动去重并检测混批',
      icon: Upload,
      completed: processStep.step1Completed,
      time: processStep.step1At,
    },
    {
      step: 2,
      title: '补看票务导出表',
      description: '核对票务信息，完善备注，标注赠票来源',
      icon: FileSpreadsheet,
      completed: processStep.step2Completed,
      time: processStep.step2At,
    },
    {
      step: 3,
      title: '授权提醒更新',
      description: '录音师10分钟内快速复核混批数据，最终授权',
      icon: ShieldCheck,
      completed: processStep.step3Completed,
      time: processStep.step3At,
    },
  ];

  return (
    <div className="glass rounded-2xl p-6 border border-white/50">
      <h3 className="font-display text-lg font-semibold text-primary-900 mb-6">处理流程</h3>
      <div className="relative">
        <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-primary-200" />
        <div className="space-y-6">
          {steps.map((s, index) => {
            const Icon = s.icon;
            const isActive = processStep.currentStep === s.step;
            const isPast = s.step < processStep.currentStep;

            return (
              <div key={s.step} className="relative flex gap-4">
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    s.completed
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                      : isActive
                      ? 'bg-accent-500 text-white shadow-lg shadow-accent-200 animate-pulse-slow'
                      : 'bg-primary-100 text-primary-400'
                  }`}
                >
                  {s.completed ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`font-semibold ${
                        s.completed || isActive ? 'text-primary-900' : 'text-primary-400'
                      }`}
                    >
                      {s.title}
                    </h4>
                    {isActive && (
                      <span className="px-2 py-0.5 bg-accent-100 text-accent-700 text-xs rounded-full font-medium">
                        当前步骤
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm mt-1 ${
                      s.completed || isActive ? 'text-primary-600' : 'text-primary-300'
                    }`}
                  >
                    {s.description}
                  </p>
                  {s.time && (
                    <p className="text-xs text-primary-400 mt-1">{formatDateTime(s.time)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
