import { useAppStore } from '../store/appStore';
import { ListOrdered, ChevronDown, ChevronRight, Calculator, Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export default function CalculationSteps() {
  const { currentResult } = useAppStore();
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!currentResult || currentResult.calculationSteps.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 shadow-xl">
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <ListOrdered className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">暂无计算步骤</p>
          <p className="text-sm mt-2 opacity-60">执行计算后将展示完整溯源过程</p>
        </div>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSteps(newExpanded);
  };

  const copyFormula = async (formula: string, id: string) => {
    await navigator.clipboard.writeText(formula);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-400" />
          计算步骤溯源
        </h2>
        <span className="text-sm text-slate-400">
          共 {currentResult.calculationSteps.length} 步
        </span>
      </div>

      <div className="space-y-2">
        {currentResult.calculationSteps.map((step) => {
          const isExpanded = expandedSteps.has(step.id);
          
          return (
            <div
              key={step.id}
              className="rounded-xl border border-slate-600/50 bg-slate-700/30 overflow-hidden"
            >
              <div
                onClick={() => toggleExpand(step.id)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                    {step.stepOrder}
                  </span>
                  <div>
                    <div className="text-white font-medium">{step.description}</div>
                    <div className="text-sm font-mono text-slate-400 mt-0.5">
                      {step.formula}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-mono text-emerald-400">
                    {step.intermediateValue.toFixed(4)} <span className="text-sm text-slate-500">{step.unit}</span>
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-slate-600/50">
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 rounded-xl p-4">
                      <div className="text-sm text-slate-400 mb-2">公式详情</div>
                      <div className="flex items-center justify-between">
                        <code className="text-sm font-mono text-cyan-300 bg-slate-800 px-3 py-2 rounded-lg flex-1 mr-3">
                          {step.formula}
                        </code>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyFormula(step.formula, step.id);
                          }}
                          className="p-2 hover:bg-slate-700 rounded-lg transition-all"
                        >
                          {copiedId === step.id ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-xl p-4">
                      <div className="text-sm text-slate-400 mb-2">输入参数</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(step.inputs).map(([key, value]) => (
                          <span
                            key={key}
                            className="px-2 py-1 bg-slate-700 rounded-md text-xs font-mono"
                          >
                            <span className="text-slate-400">{key} = </span>
                            <span className="text-amber-300">
                              {typeof value === 'number' ? value.toFixed(4) : String(value)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl p-4 border border-emerald-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-300">计算结果</span>
                      <span className="text-xl font-mono font-bold text-emerald-400">
                        {step.intermediateValue.toFixed(6)} <span className="text-sm text-slate-500">{step.unit}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>算法版本: v{currentResult.algorithmVersion}</span>
          <span>输入哈希: {currentResult.inputHash.slice(0, 16)}...</span>
        </div>
      </div>
    </div>
  );
}
