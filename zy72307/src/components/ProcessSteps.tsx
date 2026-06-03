import React from 'react';
import { ProcessStep } from '../types';

interface ProcessStepsProps {
  currentStep: ProcessStep;
  onNext: () => void;
  canProceed: boolean;
}

const steps = [
  { key: 'step1_imported', label: '步骤1：导入评分权重表', description: '第一次导入数据' },
  { key: 'step2_formula_review', label: '步骤2：查看旧公式截图', description: '教研负责人吴老师补看旧公式截图' },
  { key: 'step3_calculation_updated', label: '步骤3：计算明细更新', description: '完成计算并更新明细' }
];

export const ProcessSteps: React.FC<ProcessStepsProps> = ({ currentStep, onNext, canProceed }) => {
  const currentIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="process-steps">
      <div className="steps-container">
        {steps.map((step, index) => (
          <div 
            key={step.key} 
            className={`step-item ${index <= currentIndex ? 'active' : ''} ${index === currentIndex ? 'current' : ''}`}
          >
            <div className="step-number">{index + 1}</div>
            <div className="step-content">
              <div className="step-label">{step.label}</div>
              <div className="step-description">{step.description}</div>
            </div>
            {index < steps.length - 1 && (
              <div className={`step-line ${index < currentIndex ? 'completed' : ''}`} />
            )}
          </div>
        ))}
      </div>
      {currentIndex < steps.length - 1 && (
        <div className="step-actions">
          <button 
            className="btn-next"
            onClick={onNext}
            disabled={!canProceed}
          >
            进入下一步：{steps[currentIndex + 1].label}
          </button>
        </div>
      )}
    </div>
  );
};
