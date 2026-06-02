import React from 'react';
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react';

interface Step {
  title: string;
  description: string;
  operator?: string;
  timestamp?: string;
}

interface StepWizardProps {
  currentStep: number;
  steps: Step[];
  onStepClick?: (step: number) => void;
}

const statusMap: Record<string, { color: string; bgColor: string }> = {
  'IMPORTED': { color: 'text-audit-green', bgColor: 'bg-audit-green/10' },
  'RISK_REVIEWED': { color: 'text-audit-green', bgColor: 'bg-audit-green/10' },
  'AUDITED': { color: 'text-audit-green', bgColor: 'bg-audit-green/10' },
  'COMPLETED': { color: 'text-audit-green', bgColor: 'bg-audit-green/10' },
  'DRAFT': { color: 'text-navy-400', bgColor: 'bg-navy-100' },
};

export const StepWizard: React.FC<StepWizardProps> = ({ currentStep, steps, onStepClick }) => {
  return (
    <div className="bg-white rounded-lg border border-navy-200 p-6 mb-6">
      <h3 className="font-display text-xl text-navy-800 mb-6">三步工作流</h3>
      <div className="relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-navy-200 mx-12">
          <div 
            className="h-full bg-gradient-to-r from-navy-600 to-audit-green transition-all duration-500"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>
        
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isClickable = onStepClick && index <= currentStep;
            
            return (
              <div 
                key={index}
                className={`flex flex-col items-center relative z-10 ${isClickable ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
                onClick={() => isClickable && onStepClick!(index)}
              >
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                    ${isCompleted ? 'bg-audit-green border-audit-green text-white' :
                      isCurrent ? 'bg-navy-800 border-navy-800 text-white scale-110 shadow-lg' :
                      'bg-white border-navy-300 text-navy-400'}`}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={20} />
                  ) : isCurrent ? (
                    <Circle size={20} className="fill-current" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                
                <div className={`mt-3 text-center max-w-28 ${isCurrent ? 'scale-105' : ''} transition-transform`}>
                  <p className={`font-semibold text-sm ${isCurrent ? 'text-navy-800' : isCompleted ? 'text-navy-600' : 'text-navy-400'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-navy-500 mt-1">{step.description}</p>
                  {step.operator && (
                    <p className="text-xs text-navy-400 mt-1 font-mono">{step.operator}</p>
                  )}
                  {step.timestamp && (
                    <p className="text-xs text-navy-400 font-mono">{step.timestamp.slice(5, 16)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
