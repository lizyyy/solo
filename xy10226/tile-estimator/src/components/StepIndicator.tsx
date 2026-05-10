import React from 'react';
import { useApp } from '../context/AppContext';

const STEPS = [
  { id: 0, name: '房间信息', description: '设置房间尺寸' },
  { id: 1, name: '瓷砖选择', description: '选择瓷砖规格' },
  { id: 2, name: '铺贴方案', description: '选择铺贴方向和图案' },
  { id: 3, name: '损耗设置', description: '配置损耗模型' },
  { id: 4, name: '查看结果', description: '查看详细计算' },
];

export const StepIndicator: React.FC = () => {
  const { state, setCurrentStep } = useApp();
  const { currentStep, validationErrors } = state;

  const hasErrors = validationErrors.some(e => e.severity === 'error');

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <div
              className={`flex flex-col items-center cursor-pointer transition-all duration-200 ${
                index <= currentStep ? 'opacity-100' : 'opacity-60'
              }`}
              onClick={() => index <= currentStep && setCurrentStep(index)}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 ${
                  index === currentStep
                    ? 'bg-blue-600 text-white shadow-lg scale-110'
                    : index < currentStep
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>
              <span className={`mt-2 text-xs font-medium ${
                index === currentStep ? 'text-blue-600' : 'text-gray-600'
              }`}>
                {step.name}
              </span>
              <span className="text-xs text-gray-400">{step.description}</span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 rounded transition-all duration-200 ${
                  index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      {hasErrors && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 font-medium">
            ⚠️ 存在验证错误，请检查输入数据
          </p>
        </div>
      )}
    </div>
  );
};
