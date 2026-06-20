import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Edit3, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComputationStep } from '@/types';
import { Button } from '@/components/common/Button';
import { Tooltip } from '@/components/common/Tooltip';

interface StepDetailProps {
  step: ComputationStep;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateResult: (newResult: number, reason: string) => Promise<void>;
  disabled?: boolean;
}

export const StepDetail: React.FC<StepDetailProps> = ({
  step,
  isExpanded,
  onToggle,
  onUpdateResult,
  disabled,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEditStart = () => {
    setEditValue(step.result.toString());
    setEditReason('');
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditValue('');
    setEditReason('');
  };

  const handleEditSubmit = async () => {
    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || !editReason.trim()) return;

    setIsSubmitting(true);
    try {
      await onUpdateResult(newValue, editReason);
      setIsEditing(false);
      setEditValue('');
      setEditReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatNumber = (num: number, precision: number = 6) => {
    return num.toFixed(precision);
  };

  return (
    <div
      className={cn(
        'rounded-lg border transition-all overflow-hidden',
        step.manuallyModified
          ? 'border-[#c53030] bg-[#c53030]/5'
          : 'border-[#4a5568] bg-[#1a202c]',
        isExpanded && 'ring-1 ring-[#3182ce]'
      )}
    >
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#2d3748]/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-8 h-8 rounded flex items-center justify-center font-mono text-sm',
              step.manuallyModified ? 'bg-[#c53030]/20 text-[#fc8181]' : 'bg-[#1a365d] text-[#63b3ed]'
            )}
          >
            {step.stepOrder}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[#e2e8f0]">{step.description}</span>
              {step.manuallyModified && (
                <Tooltip content="已人工修改">
                  <span className="px-1.5 py-0.5 text-xs bg-[#c53030]/20 text-[#fc8181] rounded flex items-center gap-1">
                    <Edit3 className="w-3 h-3" />
                    已修改
                  </span>
                </Tooltip>
              )}
            </div>
            <div className="font-mono text-xs text-[#718096] mt-0.5">
              结果: <span className="text-[#a0aec0]">{formatNumber(step.result)} {step.resultUnit}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!disabled && !step.manuallyModified && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Edit3 className="w-3.5 h-3.5" />}
              onClick={(e) => {
                e.stopPropagation();
                handleEditStart();
              }}
            >
              修改
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[#718096]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#718096]" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[#4a5568]">
          <div className="pt-4 space-y-4">
            {step.formula && (
              <div className="p-3 bg-[#0d1117] rounded border border-[#4a5568]">
                <div className="text-xs font-mono text-[#718096] mb-1.5">计算公式</div>
                <code className="font-mono text-sm text-[#63b3ed]">{step.formula}</code>
              </div>
            )}

            <div>
              <div className="text-xs font-mono text-[#718096] mb-2">输入值</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(step.inputValues).map(([name, data]) => (
                  <div
                    key={name}
                    className="p-2 bg-[#0d1117] rounded border border-[#4a5568]"
                  >
                    <div className="font-mono text-xs text-[#a0aec0]">
                      {name} = {data.value} {data.unit}
                    </div>
                    {data.error !== undefined && (
                      <div className="font-mono text-xs text-[#718096] mt-0.5">
                        ± {data.error} {data.unit}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {step.unitConversion && (
              <div className="p-3 bg-[#dd6b20]/10 border border-[#dd6b20]/30 rounded">
                <div className="text-xs font-mono text-[#dd6b20] mb-1.5">单位换算</div>
                <code className="font-mono text-sm text-[#fbd38d]">
                  {step.unitConversion.formula}
                </code>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="text-[#718096]">原值: <span className="text-[#a0aec0]">{step.unitConversion.intermediateValue / step.unitConversion.conversionFactor} {step.unitConversion.originalUnit}</span></div>
                  <div className="text-[#718096]">换算因子: <span className="text-[#dd6b20]">× {step.unitConversion.conversionFactor}</span></div>
                  <div className="text-[#718096]">换算后: <span className="text-[#38a169]">{step.unitConversion.intermediateValue} {step.unitConversion.targetUnit}</span></div>
                </div>
              </div>
            )}

            {step.partialDerivatives && Object.keys(step.partialDerivatives).length > 0 && (
              <div>
                <div className="text-xs font-mono text-[#718096] mb-2">偏导数</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(step.partialDerivatives).map(([name, value]) => (
                    <div
                      key={name}
                      className="p-2 bg-[#0d1117] rounded border border-[#4a5568]"
                    >
                      <span className="font-mono text-xs text-[#a0aec0]">
                        ∂f/∂{name} = {formatNumber(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step.errorContribution && Object.keys(step.errorContribution).length > 0 && (
              <div>
                <div className="text-xs font-mono text-[#718096] mb-2">误差贡献</div>
                <div className="space-y-2">
                  {Object.entries(step.errorContribution).map(([name, value]) => {
                    const percentage = step.result !== 0 ? (Math.abs(value) / Math.abs(step.result)) * 100 : 0;
                    return (
                      <div key={name} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-[#a0aec0]">σ_{name}</span>
                          <span className="text-[#e2e8f0]">{formatNumber(value)} {step.resultUnit}</span>
                        </div>
                        <div className="h-1.5 bg-[#2d3748] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#1a365d] to-[#38a169]"
                            style={{ width: `${Math.min(percentage * 10, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isEditing && (
              <div className="p-4 bg-[#c53030]/10 border border-[#c53030]/30 rounded space-y-3">
                <div className="text-sm font-mono text-[#fc8181] mb-2">人工修改结果</div>
                <div>
                  <label className="block text-xs font-mono text-[#a0aec0] mb-1">新结果值</label>
                  <input
                    type="number"
                    step="any"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#4a5568] rounded font-mono text-[#e2e8f0] focus:outline-none focus:border-[#c53030]"
                    placeholder="输入新的结果值"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-[#a0aec0] mb-1">修改原因（必填）</label>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#4a5568] rounded font-mono text-sm text-[#e2e8f0] focus:outline-none focus:border-[#c53030] resize-none"
                    rows={2}
                    placeholder="请说明修改原因..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<X className="w-3.5 h-3.5" />}
                    onClick={handleEditCancel}
                    disabled={isSubmitting}
                  >
                    取消
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Check className="w-3.5 h-3.5" />}
                    onClick={handleEditSubmit}
                    loading={isSubmitting}
                    disabled={!editValue || !editReason.trim() || isNaN(parseFloat(editValue))}
                  >
                    确认修改
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-[#4a5568]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#718096]">最终结果</span>
                <span className="font-mono text-lg text-[#38a169]">
                  {formatNumber(step.result)} {step.resultUnit}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
