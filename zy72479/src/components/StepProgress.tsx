import { Check } from 'lucide-react';

interface StepProgressProps {
  currentStep: number;
}

const steps = [
  { number: 1, title: '导入路口照片', desc: '第一次导入主流程证据' },
  { number: 2, title: '补看公交刷卡时段', desc: '补充现场说法证据' },
  { number: 3, title: '冲突复核表更新', desc: '确认或驳回矛盾证据' },
];

export function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">处理流程</h3>
      <div className="flex items-start justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;
          
          return (
            <div key={step.number} className="flex-1 relative">
              {index < steps.length - 1 && (
                <div
                  className={`absolute top-5 left-1/2 w-full h-0.5 ${
                    isCompleted ? 'bg-success-500' : 'bg-gray-200'
                  }`}
                />
              )}
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                    isCompleted
                      ? 'bg-success-500 border-success-500 text-white'
                      : isCurrent
                      ? 'bg-primary-700 border-primary-700 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : step.number}
                </div>
                <div className="mt-3 text-center">
                  <p
                    className={`text-sm font-medium ${
                      isCompleted || isCurrent ? 'text-gray-800' : 'text-gray-400'
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 max-w-28">{step.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
