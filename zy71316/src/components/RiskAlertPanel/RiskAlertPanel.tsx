import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Search, FileText, Link2 } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { TraceRecord, RiskExplanation } from '../../types';
import { createRiskDetector } from '../../engine/riskDetector';

const riskDetector = createRiskDetector();

interface RiskCardProps {
  trace: TraceRecord;
  explanation: RiskExplanation;
}

const RiskCard: React.FC<RiskCardProps> = ({ trace, explanation }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg overflow-hidden animate-pulse-slow">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center gap-3 text-left hover:bg-red-500/5 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-red-400 truncate">{explanation.title}</h4>
          <p className="text-xs text-gray-400 truncate">{explanation.description}</p>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 animate-fadeIn">
          <div className="p-3 bg-gray-900/50 rounded-lg space-y-2">
            <div>
              <span className="text-xs text-gray-500">潜在影响:</span>
              <p className="text-xs text-red-300">{explanation.impact}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">缓解措施:</span>
              <p className="text-xs text-green-300">{explanation.mitigation}</p>
            </div>
          </div>

          <div className="p-3 bg-gray-900/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-3 h-3 text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-400">来源材料溯源</span>
            </div>
            <div className="space-y-2">
              {Object.entries(trace.paramSources).map(([param, source]) => (
                <div key={param} className="p-2 bg-gray-800/50 rounded border border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-3 h-3 text-orange-400" />
                    <span className="text-xs font-medium text-gray-300">{param}</span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-0.5">
                    <div>文档: {source.documentName || '未填写'}</div>
                    <div>版本: {source.documentVersion || '未填写'}</div>
                    <div>提供方: {source.provider || '未填写'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-gray-900/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-3 h-3 text-purple-400" />
              <span className="text-xs font-semibold text-purple-400">计算链路</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {trace.calculationChain.map((step, idx) => (
                <React.Fragment key={step}>
                  <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded">
                    {step}
                  </span>
                  {idx < trace.calculationChain.length - 1 && (
                    <span className="text-gray-500">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const RiskAlertPanel: React.FC = () => {
  const { result } = useSimulationStore();

  if (!result) {
    return (
      <div className="h-full bg-gray-900/80 backdrop-blur-sm border-l border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-bold text-gray-400 tracking-wider">风险预警</h2>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 text-sm">等待模拟结果...</p>
        </div>
      </div>
    );
  }

  const hasRisks = result.risks.length > 0;

  return (
    <div className="h-full bg-gray-900/80 backdrop-blur-sm border-l border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${hasRisks ? 'text-red-400' : 'text-green-400'}`} />
          <h2 className="text-lg font-bold text-white tracking-wider">风险预警</h2>
          {hasRisks && (
            <span className="ml-auto px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-full border border-red-500/30">
              {result.risks.length} 项风险
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {hasRisks ? (
          result.risks.map((trace) => (
            <RiskCard
              key={trace.riskType}
              trace={trace}
              explanation={riskDetector.getRiskExplanation(trace.riskType)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-green-400 font-bold mb-1">参数检查通过</h3>
            <p className="text-gray-500 text-sm">未检测到风险异常</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>风险检测项:</span>
            <span className="text-gray-400">3</span>
          </div>
          <div className="flex justify-between">
            <span>已通过:</span>
            <span className={hasRisks ? 'text-red-400' : 'text-green-400'}>
              {3 - result.risks.length}/3
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
