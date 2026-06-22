import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, GitCompare, Calculator, Wand2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComputationStep, Material, BoundaryCondition } from '@/types';
import { StepDetail } from './StepDetail';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Tooltip } from '@/components/common/Tooltip';
import { errorPropagationEngine } from '@/services/errorPropagation';
import { materialParser } from '@/services/materialParser';
import { boundaryChecker } from '@/services/boundaryChecker';

interface ComputationTimelineProps {
  steps: ComputationStep[];
  expandedSteps: string[];
  onToggleStep: (stepId: string) => void;
  onUpdateStepResult: (stepId: string, newResult: number, reason: string) => Promise<void>;
  onSetCompareMode: () => void;
  sessionId: string;
  materials?: Material[];
  disabled?: boolean;
}

interface ComputeFormData {
  formula: string;
  variables: Array<{
    name: string;
    value: number;
    unit: string;
    error: number;
    targetUnit?: string;
  }>;
  resultUnit: string;
  description: string;
  boundaryConditions: BoundaryCondition[];
}

export const ComputationTimeline: React.FC<ComputationTimelineProps> = ({
  steps,
  expandedSteps,
  onToggleStep,
  onUpdateStepResult,
  onSetCompareMode,
  sessionId,
  materials = [],
  disabled,
}) => {
  const [showComputeModal, setShowComputeModal] = useState(false);
  const [formData, setFormData] = useState<ComputeFormData>({
    formula: 'a * b',
    variables: [
      { name: 'a', value: 10, unit: 'm', error: 0.1, targetUnit: 'm' },
      { name: 'b', value: 5, unit: 'cm', error: 0.05, targetUnit: 'm' },
    ],
    resultUnit: 'm²',
    description: '面积计算',
    boundaryConditions: [],
  });
  const [autoExtractInfo, setAutoExtractInfo] = useState<{
    hasParsedData: boolean;
    formulaCount: number;
    boundaryCount: number;
  }>({ hasParsedData: false, formulaCount: 0, boundaryCount: 0 });

  useEffect(() => {
    if (materials.length > 0) {
      const parsed = materialParser.parseAllMaterials(materials);
      setAutoExtractInfo({
        hasParsedData: parsed.formulas.length > 0 || parsed.boundaryConditions.length > 0,
        formulaCount: parsed.formulas.length,
        boundaryCount: parsed.boundaryConditions.length,
      });
    }
  }, [materials]);
  const [isComputing, setIsComputing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleAddVariable = () => {
    setFormData({
      ...formData,
      variables: [
        ...formData.variables,
        { name: `x${formData.variables.length + 1}`, value: 0, unit: '', error: 0 },
      ],
    });
  };

  const handleRemoveVariable = (index: number) => {
    if (formData.variables.length <= 1) return;
    setFormData({
      ...formData,
      variables: formData.variables.filter((_, i) => i !== index),
    });
  };

  const handleVariableChange = (index: number, field: string, value: string | number) => {
    const newVariables = [...formData.variables];
    (newVariables[index] as any)[field] = value;
    setFormData({ ...formData, variables: newVariables });
  };

  const validateForm = (): boolean => {
    if (!formData.formula.trim()) {
      setValidationError('请输入计算公式');
      return false;
    }

    const variableNames = formData.variables.map((v) => v.name);
    const validation = errorPropagationEngine.validateFormula(
      formData.formula,
      variableNames
    );

    if (!validation.valid) {
      setValidationError(validation.error || '公式验证失败');
      return false;
    }

    for (let i = 0; i < formData.variables.length; i++) {
      const v = formData.variables[i];
      if (!v.name.trim()) {
        setValidationError(`变量 ${i + 1} 缺少名称`);
        return false;
      }
      if (!v.unit.trim()) {
        setValidationError(`变量 ${v.name} 缺少单位`);
        return false;
      }
    }

    if (!formData.resultUnit.trim()) {
      setValidationError('请输入结果单位');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleCompute = async () => {
    if (!validateForm() || disabled) return;

    setIsComputing(true);
    try {
      const { useComputationStore } = await import('@/stores/useComputationStore');
      const store = useComputationStore.getState();

      await store.computeErrorPropagation(
        sessionId,
        formData.formula,
        formData.variables,
        formData.resultUnit,
        formData.description,
        '现场老师',
        formData.boundaryConditions
      );

      setShowComputeModal(false);
      setValidationError(null);
    } catch (error) {
      setValidationError((error as Error).message);
    } finally {
      setIsComputing(false);
    }
  };

  const handleAutoExtract = () => {
    const suggestion = materialParser.suggestComputationFromMaterials(materials);
    if (suggestion) {
      setFormData({
        formula: suggestion.formula,
        variables: suggestion.variables,
        resultUnit: suggestion.resultUnit,
        description: suggestion.description,
        boundaryConditions: suggestion.boundaryConditions,
      });
      setValidationError(null);
    }
  };

  const handleReset = () => {
    setFormData({
      formula: '',
      variables: [{ name: '', value: 0, unit: '', error: 0, targetUnit: '' }],
      resultUnit: '',
      description: '',
      boundaryConditions: [],
    });
    setValidationError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-sm text-[#e2e8f0] tracking-wide">计算过程</h3>
          {autoExtractInfo.hasParsedData && (
            <Tooltip content={`检测到 ${autoExtractInfo.formulaCount} 个公式, ${autoExtractInfo.boundaryCount} 个边界条件`}>
              <span className="px-1.5 py-0.5 text-xs bg-[#3182ce]/20 text-[#63b3ed] rounded flex items-center gap-1">
                <Wand2 className="w-3 h-3" />
                可自动提取
              </span>
            </Tooltip>
          )}
        </div>
        <div className="flex gap-2">
          {steps.length >= 2 && (
            <Button
              size="sm"
              variant="secondary"
              icon={<GitCompare className="w-3.5 h-3.5" />}
              onClick={onSetCompareMode}
            >
              参数对照
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            icon={<Play className="w-3.5 h-3.5" />}
            onClick={() => setShowComputeModal(true)}
            disabled={disabled || !sessionId}
          >
            开始计算
          </Button>
        </div>
      </div>

      {steps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 bg-[#0d1117] border border-dashed border-[#4a5568] rounded-lg">
          <Calculator className="w-12 h-12 text-[#4a5568] mb-4" />
          <p className="font-mono text-sm text-[#718096]">暂无计算记录</p>
          <p className="font-mono text-xs text-[#4a5568] mt-1">
            点击"开始计算"按钮启动误差传播分析
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-4 bottom-4 w-0.5 bg-gradient-to-b from-[#1a365d] via-[#3182ce] to-[#38a169]" />

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.id} className="relative pl-12">
                <div
                  className={cn(
                    'absolute left-3.5 w-3 h-3 rounded-full border-2 bg-[#1a202c] z-10',
                    index < steps.length - 1
                      ? 'border-[#38a169] bg-[#38a169]'
                      : 'border-[#3182ce]',
                    step.manuallyModified && 'border-[#c53030] bg-[#c53030]'
                  )}
                />

                <div className="relative">
                  {index < steps.length - 1 && (
                    <div className="absolute -left-[18px] top-1/2 -translate-y-1/2 w-4 h-4">
                      <div className="absolute inset-0 rounded-full bg-[#38a169]/20 animate-ping" />
                    </div>
                  )}

                  <StepDetail
                    step={step}
                    isExpanded={expandedSteps.includes(step.id)}
                    onToggle={() => onToggleStep(step.id)}
                    onUpdateResult={(newResult, reason) =>
                      onUpdateStepResult(step.id, newResult, reason)
                    }
                    disabled={disabled}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={showComputeModal}
        onClose={() => !isComputing && setShowComputeModal(false)}
        title="误差传播计算"
        size="xl"
        footer={
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={handleReset}
                disabled={isComputing}
              >
                重置
              </Button>
              {autoExtractInfo.hasParsedData && (
                <Button
                  variant="secondary"
                  icon={<Wand2 className="w-3.5 h-3.5" />}
                  onClick={handleAutoExtract}
                  disabled={isComputing}
                >
                  自动提取
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowComputeModal(false)}
                disabled={isComputing}
              >
                取消
              </Button>
              <Button
                variant="primary"
                icon={<Calculator className="w-3.5 h-3.5" />}
                onClick={handleCompute}
                loading={isComputing}
              >
                执行计算
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-mono text-[#a0aec0] mb-2">
              计算公式
            </label>
            <input
              type="text"
              value={formData.formula}
              onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
              placeholder="例如: a * b + c^2"
              className="w-full px-3 py-2 bg-[#0d1117] border border-[#4a5568] rounded font-mono text-[#e2e8f0] focus:outline-none focus:border-[#3182ce]"
            />
            <p className="mt-1 text-xs text-[#718096]">
              支持 +, -, *, /, ^, sqrt(), sin(), cos(), tan(), log(), exp() 等运算
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-mono text-[#a0aec0]">变量定义</label>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAddVariable}
                disabled={isComputing}
              >
                + 添加变量
              </Button>
            </div>
            <div className="space-y-2">
              {formData.variables.map((variable, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 items-end p-3 bg-[#0d1117] rounded border border-[#4a5568]"
                >
                  <div className="col-span-2">
                    <label className="block text-xs font-mono text-[#718096] mb-1">名称</label>
                    <input
                      type="text"
                      value={variable.name}
                      onChange={(e) => handleVariableChange(index, 'name', e.target.value)}
                      placeholder="x1"
                      className="w-full px-2 py-1.5 bg-[#1a202c] border border-[#4a5568] rounded font-mono text-sm text-[#e2e8f0] focus:outline-none focus:border-[#3182ce]"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-mono text-[#718096] mb-1">数值</label>
                    <input
                      type="number"
                      step="any"
                      value={variable.value}
                      onChange={(e) => handleVariableChange(index, 'value', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-[#1a202c] border border-[#4a5568] rounded font-mono text-sm text-[#e2e8f0] focus:outline-none focus:border-[#3182ce]"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-mono text-[#718096] mb-1">原单位</label>
                    <input
                      type="text"
                      value={variable.unit}
                      onChange={(e) => handleVariableChange(index, 'unit', e.target.value)}
                      placeholder="cm"
                      className="w-full px-2 py-1.5 bg-[#1a202c] border border-[#4a5568] rounded font-mono text-sm text-[#e2e8f0] focus:outline-none focus:border-[#3182ce]"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-mono text-[#718096] mb-1">目标单位</label>
                    <input
                      type="text"
                      value={variable.targetUnit || variable.unit}
                      onChange={(e) => handleVariableChange(index, 'targetUnit', e.target.value)}
                      placeholder="m"
                      className="w-full px-2 py-1.5 bg-[#1a202c] border border-[#4a5568] rounded font-mono text-sm text-[#e2e8f0] focus:outline-none focus:border-[#3182ce]"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-mono text-[#718096] mb-1">误差±</label>
                    <input
                      type="number"
                      step="any"
                      value={variable.error}
                      onChange={(e) => handleVariableChange(index, 'error', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-[#1a202c] border border-[#4a5568] rounded font-mono text-sm text-[#e2e8f0] focus:outline-none focus:border-[#3182ce]"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveVariable(index)}
                      disabled={formData.variables.length <= 1 || isComputing}
                    >
                      移除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-mono text-[#a0aec0] mb-2">
                结果单位
              </label>
              <input
                type="text"
                value={formData.resultUnit}
                onChange={(e) => setFormData({ ...formData, resultUnit: e.target.value })}
                placeholder="m²"
                className="w-full px-3 py-2 bg-[#0d1117] border border-[#4a5568] rounded font-mono text-[#e2e8f0] focus:outline-none focus:border-[#3182ce]"
              />
            </div>
            <div>
              <label className="block text-sm font-mono text-[#a0aec0] mb-2">
                计算描述
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="例如：矩形面积计算"
                className="w-full px-3 py-2 bg-[#0d1117] border border-[#4a5568] rounded font-mono text-[#e2e8f0] focus:outline-none focus:border-[#3182ce]"
              />
            </div>
          </div>

          {formData.boundaryConditions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-mono text-[#a0aec0]">
                  边界条件（自动提取）
                </label>
                <span className="text-xs text-[#38a169] font-mono">
                  {formData.boundaryConditions.length} 个条件
                </span>
              </div>
              <div className="space-y-2 max-h-40 overflow-auto">
                {formData.boundaryConditions.map((bc, index) => (
                  <div
                    key={index}
                    className="p-2 bg-[#0d1117] rounded border border-[#4a5568] text-sm font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#63b3ed]">{bc.variable}</span>
                      <span className="text-[#a0aec0]">
                        {bc.lowerBound === -Infinity
                          ? `≤ ${bc.upperBound}`
                          : bc.upperBound === Infinity
                          ? `≥ ${bc.lowerBound}`
                          : `∈ [${bc.lowerBound}, ${bc.upperBound}]`}
                      </span>
                      <span className="text-[#718096]">({bc.unit})</span>
                    </div>
                    {bc.sourceAnchor && (
                      <div className="text-xs text-[#718096] mt-1 truncate">
                        来源: {bc.sourceAnchor}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.boundaryConditions.length > 0 &&
            formData.boundaryConditions.some(
              (bc) => bc.lowerBound === -Infinity || bc.upperBound === Infinity
            ) && (
            <div className="p-3 bg-[#dd6b20]/10 border border-[#dd6b20]/30 rounded">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#dd6b20] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#dd6b20] font-mono">部分边界条件可能不完整</p>
                  <p className="text-xs text-[#a0aec0] mt-1">
                    单侧边界（仅上限或仅下限）可能影响最终判断的准确性
                  </p>
                </div>
              </div>
            </div>
          )}

          {validationError && (
            <div className="p-3 bg-[#c53030]/10 border border-[#c53030]/30 rounded text-sm text-[#fc8181] font-mono">
              ⚠️ {validationError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
