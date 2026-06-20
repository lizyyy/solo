import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, ArrowLeftRight, AlertTriangle, FileWarning, CheckCircle2 } from 'lucide-react';
import type { Problem, ReviewResult, ReviewParams, CalculationStep } from '@/types';
import { reviewBoundary, compareResults } from '@/engine/boundaryReviewEngine';
import { constraintTypeLabel, difficultyLabel, reviewResultStatusLabel, unitCheckResultLabel } from '@/services/filterService';
import { getUnitCategory } from '@/engine/unitValidator';

interface ReviewDetailModalProps {
  problem: Problem | null;
  paramsA: ReviewParams;
  paramsB: ReviewParams;
  grayNote?: string;
  onClose: () => void;
  onUpdateParams: (group: 'A' | 'B', params: Partial<ReviewParams>) => void;
  onGrayNoteChange: (note: string) => void;
}

export default function ReviewDetailModal({
  problem,
  paramsA,
  paramsB,
  grayNote,
  onClose,
  onUpdateParams,
  onGrayNoteChange,
}: ReviewDetailModalProps) {
  const [activeGroup, setActiveGroup] = useState<'A' | 'B'>('A');
  const [showCompare, setShowCompare] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [resultA, setResultA] = useState<ReviewResult | null>(null);
  const [resultB, setResultB] = useState<ReviewResult | null>(null);
  const [editingGrayNote, setEditingGrayNote] = useState(false);
  const [tempGrayNote, setTempGrayNote] = useState('');

  useEffect(() => {
    if (problem) {
      setResultA(reviewBoundary(problem, paramsA));
      setResultB(reviewBoundary(problem, paramsB));
      setExpandedSteps({});
      setActiveGroup('A');
    }
  }, [problem, paramsA, paramsB]);

  useEffect(() => {
    if (grayNote) setTempGrayNote(grayNote);
  }, [grayNote, problem?.id]);

  if (!problem) return null;

  const activeResult = activeGroup === 'A' ? resultA : resultB;
  const activeParams = activeGroup === 'A' ? paramsA : paramsB;
  const comparison = resultA && resultB ? compareResults(resultA, resultB) : null;

  const toggleStep = (idx: number) => {
    setExpandedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleRunReview = (group: 'A' | 'B') => {
    if (!problem) return;
    const params = group === 'A' ? paramsA : paramsB;
    const result = reviewBoundary(problem, params);
    if (group === 'A') setResultA(result);
    else setResultB(result);
  };

  const handleSaveGrayNote = () => {
    onGrayNoteChange(tempGrayNote);
    setEditingGrayNote(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-academic-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in-up">
        <div className="px-6 py-4 border-b border-academic-100 flex items-start justify-between bg-gradient-to-r from-academic-600 to-academic-700">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-xs bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded">
                {problem.id}
              </span>
              <span className="text-[11px] text-academic-200">行号 #{problem.originalRow}</span>
              <span className={`tag ${
                problem.reviewStatus === 'normal' ? 'bg-status-normal/20 text-green-300 border-0' :
                problem.reviewStatus === 'abnormal' ? 'bg-status-abnormal/20 text-red-300 border-0' :
                problem.reviewStatus === 'unit_issue' ? 'bg-status-unit/20 text-purple-300 border-0' :
                'bg-white/10 text-white border-0'
              }`}>
                {reviewResultStatusLabel(problem.reviewStatus)}
              </span>
            </div>
            <h2 className="font-display text-xl font-semibold text-white">{problem.title}</h2>
            <div className="flex items-center gap-3 mt-2 text-xs text-academic-200">
              <span>{constraintTypeLabel(problem.constraintType)}</span>
              <span>·</span>
              <span>{difficultyLabel(problem.difficulty)}</span>
              <span>·</span>
              <span>{problem.knowledgePoint}</span>
              {problem.boundaryUnit && (
                <>
                  <span>·</span>
                  <span className="font-mono">单位类别: {getUnitCategory(problem.boundaryUnit)}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {(grayNote || editingGrayNote) && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
            <div className="flex items-start gap-2">
              <FileWarning className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-800 mb-1">灰度发布备注 · 复核影响说明</p>
                {editingGrayNote ? (
                  <div className="flex gap-2">
                    <input
                      value={tempGrayNote}
                      onChange={(e) => setTempGrayNote(e.target.value)}
                      placeholder="说明本次复核改变了哪些判断..."
                      className="flex-1 px-3 py-1.5 text-sm border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button onClick={handleSaveGrayNote} className="btn-gold px-3 py-1 text-xs">
                      保存
                    </button>
                    <button onClick={() => setEditingGrayNote(false)} className="btn-secondary px-3 py-1 text-xs">
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-amber-900 leading-relaxed">{grayNote || '（暂无备注）'}</p>
                    <button
                      onClick={() => setEditingGrayNote(true)}
                      className="text-xs text-amber-700 hover:text-amber-900 font-medium flex-shrink-0"
                    >
                      编辑
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-3 border-b border-academic-100 bg-academic-50/50">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => { setActiveGroup('A'); setShowCompare(false); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeGroup === 'A' && !showCompare
                    ? 'bg-academic-600 text-white shadow-md'
                    : 'bg-white text-academic-600 border border-academic-200 hover:border-academic-400'
                }`}
              >
                A组参数 · 容差 {paramsA.tolerance * 100}%
              </button>
              <button
                onClick={() => { setActiveGroup('B'); setShowCompare(false); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeGroup === 'B' && !showCompare
                    ? 'bg-academic-600 text-white shadow-md'
                    : 'bg-white text-academic-600 border border-academic-200 hover:border-academic-400'
                }`}
              >
                B组参数 · 容差 {paramsB.tolerance * 100}%
              </button>
              <button
                onClick={() => setShowCompare(!showCompare)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                  showCompare
                    ? 'bg-amber-500 text-white shadow-gold-glow'
                    : 'bg-white text-amber-700 border border-amber-300 hover:border-amber-500'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                对照
              </button>
            </div>
            <button
              onClick={() => handleRunReview(activeGroup)}
              className="btn-primary text-xs"
            >
              重新复核
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {showCompare && comparison ? (
            <CompareView resultA={resultA} resultB={resultB} comparison={comparison} />
          ) : activeResult ? (
            <ReviewDetailView
              result={activeResult}
              params={activeParams}
              group={activeGroup}
              problem={problem}
              expandedSteps={expandedSteps}
              onToggleStep={toggleStep}
              onUpdateParams={(partial) => onUpdateParams(activeGroup, partial)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CompareView({
  resultA, resultB, comparison,
}: {
  resultA: ReviewResult | null;
  resultB: ReviewResult | null;
  comparison: { statusChanged: boolean; deviationDiff: number; summary: string };
}) {
  if (!resultA || !resultB) return null;

  return (
    <div className="space-y-5">
      <div className={`card-academic p-4 border-l-4 ${
        comparison.statusChanged ? 'border-l-status-abnormal' : 'border-l-status-normal'
      }`}>
        <p className="text-sm font-medium text-academic-800">{comparison.summary}</p>
        {comparison.statusChanged && resultB.changedJudgments.length > 0 && (
          <div className="mt-2 pt-2 border-t border-academic-100">
            <p className="text-xs font-semibold text-status-abnormal mb-1.5">B组改变的判断：</p>
            <ul className="space-y-1">
              {resultB.changedJudgments.map((j, i) => (
                <li key={i} className="text-xs text-status-abnormal flex items-start gap-1.5">
                  <span>•</span>
                  <span>{j}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ResultCard result={resultA} label="A组结果" />
        <ResultCard result={resultB} label="B组结果" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card-academic p-4">
          <h4 className="text-sm font-semibold text-academic-800 mb-3">A组计算步骤摘要</h4>
          <div className="space-y-2">
            {resultA.calculationSteps.slice(-3).map((step) => (
              <StepMini key={step.stepIndex} step={step} />
            ))}
          </div>
        </div>
        <div className="card-academic p-4">
          <h4 className="text-sm font-semibold text-academic-800 mb-3">B组计算步骤摘要</h4>
          <div className="space-y-2">
            {resultB.calculationSteps.slice(-3).map((step) => (
              <StepMini key={step.stepIndex} step={step} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result, label }: { result: ReviewResult; label: string }) {
  return (
    <div className="card-academic p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-academic-800">{label}</h4>
        {result.status === 'normal' && <span className="tag-normal">正常</span>}
        {result.status === 'abnormal' && <span className="tag-abnormal">异常</span>}
        {result.status === 'unit_issue' && <span className="tag-unit">单位问题</span>}
        {result.status === 'skipped' && <span className="tag-pending">已跳过</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-academic-500">偏差</p>
          <p className="font-mono font-semibold text-academic-800">{(result.deviation * 100).toFixed(3)}%</p>
        </div>
        <div>
          <p className="text-xs text-academic-500">单位校验</p>
          <p className={`font-medium ${
            result.unitCheckResult === 'pass' ? 'text-status-normal' : 'text-status-unit'
          }`}>
            {unitCheckResultLabel(result.unitCheckResult)}
          </p>
        </div>
      </div>
      {result.problematicRow && (
        <div className="mt-3 pt-3 border-t border-academic-100">
          <p className="text-xs text-status-abnormal font-medium">{result.problematicRow}</p>
        </div>
      )}
    </div>
  );
}

function StepMini({ step }: { step: CalculationStep }) {
  return (
    <div className="p-2 bg-academic-50 rounded text-xs">
      <div className="flex justify-between items-center text-academic-600 mb-1">
        <span className="font-medium">#{step.stepIndex} {step.description}</span>
        <span className="font-mono text-academic-800 font-semibold">
          {typeof step.outputValue === 'number' ? step.outputValue.toFixed(4) : step.outputValue}
          {step.outputUnit && ` ${step.outputUnit}`}
        </span>
      </div>
      <p className="font-mono text-[11px] text-academic-500">{step.formula}</p>
    </div>
  );
}

function ReviewDetailView({
  result,
  params,
  group,
  problem,
  expandedSteps,
  onToggleStep,
  onUpdateParams,
}: {
  result: ReviewResult;
  params: ReviewParams;
  group: 'A' | 'B';
  problem: Problem;
  expandedSteps: Record<number, boolean>;
  onToggleStep: (idx: number) => void;
  onUpdateParams: (partial: Partial<ReviewParams>) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-1 space-y-4">
        <div className="card-academic p-4">
          <h4 className="text-sm font-semibold text-academic-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-academic-100 flex items-center justify-center text-xs font-bold text-academic-600">
              {group}
            </span>
            复核参数
          </h4>
          <div className="space-y-3">
            <ParamInput
              label="容差值"
              suffix="%"
              value={params.tolerance * 100}
              onChange={(v) => onUpdateParams({ tolerance: v / 100 })}
            />
            <ParamInput
              label="边界系数"
              value={params.boundaryMultiplier}
              step={0.05}
              onChange={(v) => onUpdateParams({ boundaryMultiplier: v })}
            />
            <div>
              <p className="text-xs text-academic-500 mb-1.5">单位制</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdateParams({ unitSystem: 'metric' })}
                  className={`flex-1 text-xs py-1.5 rounded transition-all ${
                    params.unitSystem === 'metric'
                      ? 'bg-academic-600 text-white'
                      : 'bg-academic-50 text-academic-600 hover:bg-academic-100'
                  }`}
                >
                  公制
                </button>
                <button
                  onClick={() => onUpdateParams({ unitSystem: 'imperial' })}
                  className={`flex-1 text-xs py-1.5 rounded transition-all ${
                    params.unitSystem === 'imperial'
                      ? 'bg-academic-600 text-white'
                      : 'bg-academic-50 text-academic-600 hover:bg-academic-100'
                  }`}
                >
                  英制
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-academic-500">严格模式</p>
              <button
                onClick={() => onUpdateParams({ strictMode: !params.strictMode })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  params.strictMode ? 'bg-academic-600' : 'bg-academic-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    params.strictMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {result.status === 'unit_issue' && (
          <div className="card-academic p-4 border-l-4 border-l-status-unit">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-status-unit mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-status-unit mb-1">单位校验失败</p>
                <p className="text-xs text-academic-600 leading-relaxed">
                  {result.unitCheckResult === 'missing'
                    ? `题目「${problem.id}」单位缺失，复核结果已独立标记，未混入正常结果统计。`
                    : `单位不匹配或换算错误，已分离展示。`}
                </p>
              </div>
            </div>
          </div>
        )}

        {result.changedJudgments.length > 0 && (
          <div className="card-academic p-4 border-l-4 border-l-amber-500">
            <p className="text-xs font-semibold text-amber-800 mb-2">本次复核改变的判断</p>
            <ul className="space-y-1">
              {result.changedJudgments.map((j, i) => (
                <li key={i} className="text-xs text-amber-900 flex items-start gap-1.5">
                  <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{j}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.problematicRow && (
          <div className="card-academic p-4 border-l-4 border-l-status-abnormal">
            <p className="text-xs font-semibold text-status-abnormal mb-1">问题行定位</p>
            <p className="text-xs text-status-abnormal leading-relaxed">{result.problematicRow}</p>
          </div>
        )}
      </div>

      <div className="col-span-2 space-y-4">
        <div className="card-academic p-4">
          <h4 className="text-sm font-semibold text-academic-800 mb-3">中间计算过程</h4>
          <p className="text-xs text-academic-500 mb-4">
            展开每一步可查看输入输出值、计算公式及单位换算细节
          </p>
          <div className="space-y-2">
            {result.calculationSteps.map((step) => (
              <CalculationStepCard
                key={step.stepIndex}
                step={step}
                expanded={!!expandedSteps[step.stepIndex]}
                onToggle={() => onToggleStep(step.stepIndex)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ParamInput({
  label, value, onChange, step = 0.01, suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-xs text-academic-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 px-3 py-1.5 text-sm font-mono border border-academic-200 rounded-md focus:outline-none focus:ring-2 focus:ring-academic-400 focus:border-transparent"
        />
        {suffix && <span className="text-xs text-academic-500 w-6">{suffix}</span>}
      </div>
    </div>
  );
}

function CalculationStepCard({
  step,
  expanded,
  onToggle,
}: {
  step: CalculationStep;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isUnitStep = !!step.unitConversion;

  return (
    <div
      className={`rounded-lg border transition-all ${
        isUnitStep
          ? 'border-status-unit/30 bg-status-unit/5'
          : 'border-academic-100 bg-academic-50/50 hover:border-academic-200'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            isUnitStep ? 'bg-status-unit text-white' : 'bg-academic-200 text-academic-700'
          }`}>
            {step.stepIndex}
          </span>
          <div>
            <p className={`text-sm font-medium ${isUnitStep ? 'text-status-unit' : 'text-academic-800'}`}>
              {step.description}
            </p>
            {isUnitStep && (
              <p className="text-xs text-status-unit/80 mt-0.5">{step.unitConversion}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-academic-700 tabular-nums">
            {typeof step.outputValue === 'number' ? step.outputValue.toFixed(4) : step.outputValue}
            {step.outputUnit && <span className="text-academic-500 text-xs ml-1">{step.outputUnit}</span>}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-academic-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-academic-400" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-academic-100/50 mt-0 pt-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-academic-500 mb-1">输入值</p>
              <p className="font-mono text-sm text-academic-800">
                {step.inputValue}
                {step.inputUnit && <span className="text-academic-500 text-xs ml-1">{step.inputUnit}</span>}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-academic-500 mb-1">输出值</p>
              <p className="font-mono text-sm text-academic-800">
                {step.outputValue}
                {step.outputUnit && <span className="text-academic-500 text-xs ml-1">{step.outputUnit}</span>}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-academic-500 mb-1">类型</p>
              <p className="text-sm">
                {isUnitStep ? (
                  <span className="tag-unit">单位换算</span>
                ) : (
                  <span className="tag-normal">数值计算</span>
                )}
              </p>
            </div>
          </div>
          <div className="mt-3 p-3 bg-academic-900 rounded-md">
            <p className="text-[11px] text-academic-400 mb-1">计算公式</p>
            <code className="font-mono text-xs text-amber-300">{step.formula}</code>
          </div>
          {step.unitConversion && (
            <div className="mt-3 p-3 bg-status-unit/10 rounded-md border border-status-unit/20">
              <p className="text-[11px] text-status-unit font-semibold mb-1">单位换算说明</p>
              <p className="text-xs text-status-unit">{step.unitConversion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
