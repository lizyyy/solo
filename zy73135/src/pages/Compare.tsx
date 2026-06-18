import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { parameterTypeLabels } from '@/types';
import { getCleaningStepsByScheme, getCleanedValueByScheme } from '@/data/records';
import RecordCard from '@/components/common/RecordCard';
import { GitCompare, ArrowDown, ArrowUp, Minus, ChevronDown, ChevronUp } from 'lucide-react';

export default function Compare() {
  const { records, schemes, activeSchemeId, setActiveScheme } = useAppStore();
  const [compareSchemeId, setCompareSchemeId] = useState<string>('scheme-strict');
  const [selectedRecordId, setSelectedRecordId] = useState<string>('rec-002');
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);

  const selectedRecord = records.find((r) => r.id === selectedRecordId);
  const activeScheme = schemes.find((s) => s.id === activeSchemeId);
  const compareScheme = schemes.find((s) => s.id === compareSchemeId);

  const activeSteps = selectedRecord ? getCleaningStepsByScheme(selectedRecord, activeSchemeId) : [];
  const compareSteps = selectedRecord ? getCleaningStepsByScheme(selectedRecord, compareSchemeId) : [];

  const activeFinalValue = selectedRecord ? getCleanedValueByScheme(selectedRecord, activeSchemeId) : 0;
  const compareFinalValue = selectedRecord ? getCleanedValueByScheme(selectedRecord, compareSchemeId) : 0;
  const valueDiff = compareFinalValue - activeFinalValue;
  const valueDiffPercent = activeFinalValue ? ((valueDiff / activeFinalValue) * 100).toFixed(2) : '0';

  const getStepDiff = (stepIndex: number) => {
    if (!activeSteps[stepIndex] || !compareSteps[stepIndex]) return 0;
    return compareSteps[stepIndex].outputValue - activeSteps[stepIndex].outputValue;
  };

  const hasSignificantDiff = (stepIndex: number) => {
    const diff = Math.abs(getStepDiff(stepIndex));
    return diff > 0.01;
  };

  const toggleStepExpand = (index: number) => {
    setExpandedSteps((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-80 border-r border-ocean-700 flex flex-col bg-ocean-900/30">
        <div className="p-4 border-b border-ocean-700">
          <h2 className="text-lg font-semibold text-white">选择记录</h2>
          <p className="text-sm text-ocean-400 mt-1">点击查看参数对比效果</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {records.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              selected={selectedRecordId === record.id}
              onClick={() => setSelectedRecordId(record.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-ocean-900/80 backdrop-blur border-b border-ocean-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <GitCompare className="w-6 h-6 text-nautical-warning" />
                参数对比面板
              </h1>
              <p className="text-sm text-ocean-400 mt-0.5">
                对比不同清洗参数方案的差异，追溯结果变化的来源
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-ocean-500 mb-1">当前方案</p>
                <select
                  value={activeSchemeId}
                  onChange={(e) => setActiveScheme(e.target.value)}
                  className="bg-ocean-800 border border-ocean-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nautical-warning/50"
                >
                  {schemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-2xl text-ocean-600">VS</div>

              <div className="text-right">
                <p className="text-xs text-ocean-500 mb-1">对比方案</p>
                <select
                  value={compareSchemeId}
                  onChange={(e) => setCompareSchemeId(e.target.value)}
                  className="bg-ocean-800 border border-nautical-warning/50 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nautical-warning"
                >
                  {schemes.filter((s) => s.id !== activeSchemeId).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {selectedRecord && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-ocean-800/50 rounded-xl border border-ocean-700 p-5">
                  <p className="text-sm text-ocean-400 mb-2">{activeScheme?.name}</p>
                  <p className="text-3xl font-bold text-white font-mono">
                    {activeFinalValue.toFixed(2)}
                    <span className="text-base font-normal text-ocean-500 ml-1">
                      {selectedRecord.unit}
                    </span>
                  </p>
                  <p className="text-xs text-ocean-500 mt-2">{parameterTypeLabels[selectedRecord.parameterType]}</p>
                </div>

                <div className="bg-ocean-800/50 rounded-xl border border-nautical-warning/30 p-5 flex flex-col items-center justify-center">
                  <p className="text-sm text-ocean-400 mb-2">差异</p>
                  <div className={`text-3xl font-bold font-mono flex items-center gap-2 ${
                    valueDiff > 0 ? 'text-nautical-success' : valueDiff < 0 ? 'text-nautical-danger' : 'text-ocean-400'
                  }`}>
                    {valueDiff > 0 ? <ArrowUp className="w-6 h-6" /> : valueDiff < 0 ? <ArrowDown className="w-6 h-6" /> : <Minus className="w-6 h-6" />}
                    {Math.abs(valueDiff).toFixed(2)}
                  </div>
                  <p className={`text-sm mt-1 ${
                    valueDiff > 0 ? 'text-nautical-success/70' : valueDiff < 0 ? 'text-nautical-danger/70' : 'text-ocean-500'
                  }`}>
                    {valueDiff > 0 ? '+' : ''}{valueDiffPercent}%
                  </p>
                </div>

                <div className="bg-ocean-800/50 rounded-xl border border-ocean-700 p-5">
                  <p className="text-sm text-ocean-400 mb-2">{compareScheme?.name}</p>
                  <p className="text-3xl font-bold text-white font-mono">
                    {compareFinalValue.toFixed(2)}
                    <span className="text-base font-normal text-ocean-500 ml-1">
                      {selectedRecord.unit}
                    </span>
                  </p>
                  <p className="text-xs text-ocean-500 mt-2">{parameterTypeLabels[selectedRecord.parameterType]}</p>
                </div>
              </div>

              <div className="bg-ocean-800/30 rounded-xl border border-ocean-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  差异步骤追溯
                  <span className="text-xs font-normal bg-nautical-warning/20 text-nautical-warning px-2 py-0.5 rounded-full">
                    {activeSteps.filter((_, i) => hasSignificantDiff(i)).length} 处差异
                  </span>
                </h3>

                <div className="space-y-3">
                  {activeSteps.map((step, index) => {
                    const compareStep = compareSteps[index];
                    const hasDiff = hasSignificantDiff(index);
                    const diff = getStepDiff(index);
                    const isExpanded = expandedSteps.includes(index);

                    return (
                      <div
                        key={step.id}
                        className={`rounded-lg border transition-all duration-300 ${
                          hasDiff
                            ? 'bg-nautical-warning/5 border-nautical-warning/40'
                            : 'bg-ocean-800/30 border-ocean-700'
                        }`}
                      >
                        <div
                          className="flex items-center p-4 cursor-pointer"
                          onClick={() => toggleStepExpand(index)}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${
                            hasDiff ? 'bg-nautical-warning/20' : 'bg-ocean-700'
                          }`}>
                            <span className={`text-sm font-bold ${
                              hasDiff ? 'text-nautical-warning' : 'text-ocean-300'
                            }`}>
                              {step.stepOrder}
                            </span>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className={`font-medium ${
                                hasDiff ? 'text-white' : 'text-ocean-300'
                              }`}>
                                {step.stepName}
                              </h4>
                              {hasDiff && (
                                <span className="text-xs px-2 py-0.5 bg-nautical-warning/20 text-nautical-warning rounded-full">
                                  有差异
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-ocean-500 mt-0.5">
                              {step.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs text-ocean-500">{activeScheme?.name}</p>
                              <p className="font-mono text-white">{step.outputValue.toFixed(2)}</p>
                            </div>

                            <div className={`flex items-center gap-1 font-mono font-medium ${
                              diff > 0 ? 'text-nautical-success' : diff < 0 ? 'text-nautical-danger' : 'text-ocean-500'
                            }`}>
                              {diff > 0 ? <ArrowUp className="w-4 h-4" /> : diff < 0 ? <ArrowDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                              {diff === 0 ? '0.00' : (diff > 0 ? '+' : '') + diff.toFixed(2)}
                            </div>

                            <div className="text-right">
                              <p className="text-xs text-ocean-500">{compareScheme?.name}</p>
                              <p className="font-mono text-white">{compareStep?.outputValue.toFixed(2)}</p>
                            </div>

                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-ocean-500" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-ocean-500" />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-0">
                            <div className="ml-14 pl-4 border-l border-ocean-700 py-2 space-y-2">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="bg-ocean-800/50 rounded-lg p-3">
                                  <p className="text-xs text-ocean-500 mb-1">{activeScheme?.name} 输入</p>
                                  <p className="font-mono text-ocean-200">{step.inputValue.toFixed(2)}</p>
                                </div>
                                <div className="bg-ocean-800/50 rounded-lg p-3">
                                  <p className="text-xs text-ocean-500 mb-1">{compareScheme?.name} 输入</p>
                                  <p className="font-mono text-ocean-200">{compareStep?.inputValue.toFixed(2)}</p>
                                </div>
                              </div>
                              
                              {hasDiff && (
                                <div className="bg-nautical-warning/10 rounded-lg p-3">
                                  <p className="text-xs text-nautical-warning font-medium mb-1">
                                    差异原因分析
                                  </p>
                                  <p className="text-sm text-ocean-300">
                                    {step.stepOrder === 2 && '异常值剔除标准不同：严格方案采用3σ准则，剔除更多离群数据点'}
                                    {step.stepOrder === 3 && '漂移校正强度不同：严格方案对漂移量采用1.1倍补偿系数'}
                                    {step.stepOrder === 4 && '平滑窗口大小不同：严格方案使用五点三次平滑，降噪效果更强'}
                                    {step.stepOrder !== 2 && step.stepOrder !== 3 && step.stepOrder !== 4 && '参数配置差异导致计算结果不同'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-ocean-800/30 rounded-xl border border-ocean-700 p-5">
                  <h4 className="text-white font-medium mb-3">{activeScheme?.name} 参数配置</h4>
                  <p className="text-sm text-ocean-400 mb-4">{activeScheme?.description}</p>
                  <div className="space-y-2">
                    {activeScheme && Object.entries(activeScheme.parameters).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-ocean-400">
                          {key === 'outlierThreshold' && '异常值阈值 (σ)'}
                          {key === 'driftCorrectionEnabled' && '漂移校正'}
                          {key === 'smoothingWindowSize' && '平滑窗口大小'}
                          {key === 'interpolationMethod' && '插值方法'}
                          {key === 'minValidValue' && '最小有效值'}
                          {key === 'maxValidValue' && '最大有效值'}
                        </span>
                        <span className="text-white font-mono">
                          {typeof value === 'boolean' ? (value ? '启用' : '禁用') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-ocean-800/30 rounded-xl border border-ocean-700 p-5">
                  <h4 className="text-white font-medium mb-3">{compareScheme?.name} 参数配置</h4>
                  <p className="text-sm text-ocean-400 mb-4">{compareScheme?.description}</p>
                  <div className="space-y-2">
                    {compareScheme && Object.entries(compareScheme.parameters).map(([key, value]) => {
                      const activeValue = activeScheme?.parameters[key as keyof typeof activeScheme.parameters];
                      const isDiff = activeValue !== value;

                      return (
                        <div key={key} className={`flex items-center justify-between text-sm ${
                          isDiff ? 'bg-nautical-warning/10 -mx-2 px-2 py-1 rounded' : ''
                        }`}>
                          <span className="text-ocean-400">
                            {key === 'outlierThreshold' && '异常值阈值 (σ)'}
                            {key === 'driftCorrectionEnabled' && '漂移校正'}
                            {key === 'smoothingWindowSize' && '平滑窗口大小'}
                            {key === 'interpolationMethod' && '插值方法'}
                            {key === 'minValidValue' && '最小有效值'}
                            {key === 'maxValidValue' && '最大有效值'}
                          </span>
                          <span className={`font-mono ${
                            isDiff ? 'text-nautical-warning font-medium' : 'text-white'
                          }`}>
                            {typeof value === 'boolean' ? (value ? '启用' : '禁用') : String(value)}
                            {isDiff && ' *'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
