import { Check, FileText, Eye, RefreshCw } from 'lucide-react';
import type { ClaimRecord } from '../../types/claim';

interface ProcessStepsProps {
  record: ClaimRecord;
}

type StepKey = 'import' | 'review' | 'update';

const steps: { key: StepKey; label: string; icon: typeof FileText; desc: string }[] = [
  { key: 'import', label: '导入人工改判表', icon: FileText, desc: '主流程数据导入' },
  { key: 'review', label: '补看提示词版本号', icon: Eye, desc: '现场说法核对' },
  { key: 'update', label: '证据回放更新', icon: RefreshCw, desc: '整合最终结果' },
];

export function ProcessSteps({ record }: ProcessStepsProps) {
  const getStepStatus = (key: StepKey): 'done' | 'current' | 'pending' => {
    const hasManual = !!record.manualJudgment;
    const hasPrompt = !!record.promptVersion;
    const isDone = record.status === 'completed' || record.status === 'pending_verify' || record.status === 'conflict';

    if (key === 'import') {
      return hasManual ? 'done' : 'current';
    }
    if (key === 'review') {
      if (hasPrompt) return 'done';
      if (hasManual) return 'current';
      return 'pending';
    }
    if (key === 'update') {
      if (isDone) return 'done';
      if (hasPrompt) return 'current';
      return 'pending';
    }
    return 'pending';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">处理流程</h3>
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const status = getStepStatus(step.key);
          const Icon = step.icon;
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.key} className="flex-1 flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    status === 'done'
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : status === 'current'
                        ? 'bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  {status === 'done' ? <Check size={18} /> : <Icon size={18} />}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={`text-xs font-medium ${
                      status === 'done'
                        ? 'text-emerald-700'
                        : status === 'current'
                          ? 'text-blue-700'
                          : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{step.desc}</div>
                </div>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    status === 'done' ? 'bg-emerald-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
