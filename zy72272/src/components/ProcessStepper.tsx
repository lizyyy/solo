import React from 'react';
import { Check, Upload, Layers, Download } from 'lucide-react';
import type { ProcessState } from '../../shared/types';
import { ProcessStep, STEP_LABELS } from '../../shared/types';

interface ProcessStepperProps {
  processState: ProcessState;
}

const steps = [
  { key: ProcessStep.IMPORT, icon: Upload, label: '导入巡检照片编号' },
  { key: ProcessStep.CAD_SUPPLEMENT, icon: Layers, label: '补录CAD图层名' },
  { key: ProcessStep.EXPORT, icon: Download, label: '导出截图' },
];

export const ProcessStepper: React.FC<ProcessStepperProps> = ({ processState }) => {
  const getStepState = (stepKey: ProcessStep) => {
    const stepOrder = [ProcessStep.IMPORT, ProcessStep.CAD_SUPPLEMENT, ProcessStep.EXPORT];
    const currentIdx = stepOrder.indexOf(processState.currentStep);
    const stepIdx = stepOrder.indexOf(stepKey);

    if (stepIdx < currentIdx ||
        (stepKey === ProcessStep.IMPORT && processState.importCompleted) ||
        (stepKey === ProcessStep.CAD_SUPPLEMENT && processState.cadCompleted) ||
        (stepKey === ProcessStep.EXPORT && processState.exportCompleted)) {
      return 'completed';
    }
    if (stepKey === processState.currentStep) {
      return 'active';
    }
    return 'pending';
  };

  return (
    <div className="w-full bg-industrial-card rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-industrial-text">
          演示流程进度
        </h2>
        <span className="text-sm text-industrial-muted">
          {STEP_LABELS[processState.currentStep]}
        </span>
      </div>

      <div className="relative">
        <div className="absolute top-6 left-0 right-0 h-1 bg-industrial-border z-0">
          <div
            className="h-full bg-primary-600 transition-all duration-500"
            style={{
              width: processState.exportCompleted
                ? '100%'
                : processState.cadCompleted
                ? '66%'
                : processState.importCompleted
                ? '33%'
                : '0%',
            }}
          />
        </div>

        <div className="flex justify-between relative z-10">
          {steps.map((step, index) => {
            const state = getStepState(step.key);
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    state === 'completed'
                      ? 'step-completed'
                      : state === 'active'
                      ? 'step-active'
                      : 'step-pending'
                  }`}
                >
                  {state === 'completed' ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`mt-2 text-sm font-medium ${
                    state === 'pending' ? 'text-industrial-muted' : 'text-industrial-text'
                  }`}
                >
                  {index + 1}. {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
