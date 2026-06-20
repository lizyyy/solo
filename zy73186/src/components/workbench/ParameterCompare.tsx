import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComputationStep } from '@/types';
import { Button } from '@/components/common/Button';

interface ParameterCompareProps {
  leftSteps: ComputationStep[] | null;
  rightSteps: ComputationStep[] | null;
  onClose: () => void;
}

export const ParameterCompare: React.FC<ParameterCompareProps> = ({
  leftSteps,
  rightSteps,
  onClose,
}) => {
  if (!leftSteps || !rightSteps) return null;

  const formatNumber = (num: number, precision: number = 6) => num.toFixed(precision);

  const findMatchingStep = (step: ComputationStep, steps: ComputationStep[]) => {
    return steps.find(
      (s) => s.description === step.description || s.stepOrder === step.stepOrder
    );
  };

  const hasDifference = (step1: ComputationStep, step2: ComputationStep) => {
    return Math.abs(step1.result - step2.result) > 1e-10;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
      <div className="w-full max-w-6xl h-[80vh] bg-[#1a202c] border border-[#4a5568] rounded-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#4a5568]">
          <h3 className="font-mono text-lg text-[#e2e8f0] tracking-wide">参数对照分析</h3>
          <Button variant="ghost" size="sm" icon={<X className="w-4 h-4" />} onClick={onClose}>
            关闭
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 divide-x divide-[#4a5568] h-full">
            <div className="p-6">
              <div className="mb-4 pb-4 border-b border-[#4a5568]">
                <h4 className="font-mono text-sm text-[#63b3ed] mb-2">参数组 A</h4>
                <p className="text-xs text-[#718096]">共 {leftSteps.length} 个计算步骤</p>
              </div>
              <div className="space-y-4">
                {leftSteps.map((step) => {
                  const matchingStep = findMatchingStep(step, rightSteps);
                  const diff = matchingStep && hasDifference(step, matchingStep);

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        'p-4 rounded-lg border transition-colors',
                        diff
                          ? 'border-[#c53030] bg-[#c53030]/5'
                          : 'border-[#4a5568] bg-[#0d1117]'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded bg-[#1a365d] flex items-center justify-center text-xs font-mono text-[#63b3ed]">
                          {step.stepOrder}
                        </span>
                        <span className="font-mono text-sm text-[#e2e8f0]">{step.description}</span>
                        {diff && (
                          <span className="ml-auto px-2 py-0.5 text-xs bg-[#c53030]/20 text-[#fc8181] rounded">
                            有差异
                          </span>
                        )}
                      </div>
                      <code className="block font-mono text-xs text-[#a0aec0] mb-2">
                        {step.formula}
                      </code>
                      <div className="font-mono text-lg text-[#38a169]">
                        {formatNumber(step.result)} {step.resultUnit}
                      </div>
                      {step.unitConversion && (
                        <div className="mt-2 text-xs font-mono text-[#dd6b20]">
                          换算: {step.unitConversion.formula}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4 pb-4 border-b border-[#4a5568]">
                <h4 className="font-mono text-sm text-[#68d391] mb-2">参数组 B</h4>
                <p className="text-xs text-[#718096]">共 {rightSteps.length} 个计算步骤</p>
              </div>
              <div className="space-y-4">
                {rightSteps.map((step) => {
                  const matchingStep = findMatchingStep(step, leftSteps);
                  const diff = matchingStep && hasDifference(step, matchingStep);

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        'p-4 rounded-lg border transition-colors',
                        diff
                          ? 'border-[#c53030] bg-[#c53030]/5'
                          : 'border-[#4a5568] bg-[#0d1117]'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded bg-[#276749] flex items-center justify-center text-xs font-mono text-[#9ae6b4]">
                          {step.stepOrder}
                        </span>
                        <span className="font-mono text-sm text-[#e2e8f0]">{step.description}</span>
                        {diff && (
                          <span className="ml-auto px-2 py-0.5 text-xs bg-[#c53030]/20 text-[#fc8181] rounded">
                            有差异
                          </span>
                        )}
                      </div>
                      <code className="block font-mono text-xs text-[#a0aec0] mb-2">
                        {step.formula}
                      </code>
                      <div className="font-mono text-lg text-[#38a169]">
                        {formatNumber(step.result)} {step.resultUnit}
                      </div>
                      {step.unitConversion && (
                        <div className="mt-2 text-xs font-mono text-[#dd6b20]">
                          换算: {step.unitConversion.formula}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#4a5568] bg-[#0d1117]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs font-mono text-[#718096]">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#c53030]" />
                标记差异
              </span>
              <span className="flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
                单位换算追踪
              </span>
            </div>
            <p className="text-xs text-[#718096]">
              差异高亮显示两组参数计算结果不一致的步骤，便于排查单位换算或公式代入问题
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
