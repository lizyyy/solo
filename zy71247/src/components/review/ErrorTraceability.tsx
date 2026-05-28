import { ErrorAnalysis } from '../../types';
import { AlertTriangle, AlertCircle, XCircle, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface ErrorTraceabilityProps {
  errors: ErrorAnalysis[];
}

const errorLabels: Record<string, string> = {
  insufficient_sampling: '采样不足',
  track_deviation: '航迹偏移',
  excessive_noise: '噪声过高'
};

const severityColors: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  low: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    icon: <AlertCircle className="w-5 h-5 text-yellow-400" />
  },
  medium: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    icon: <AlertTriangle className="w-5 h-5 text-orange-400" />
  },
  high: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: <XCircle className="w-5 h-5 text-red-400" />
  }
};

export function ErrorTraceability({ errors }: ErrorTraceabilityProps) {
  const [expandedError, setExpandedError] = useState<string | null>(null);

  if (errors.length === 0) {
    return (
      <div className="card-bg rounded-lg p-6 border border-green-500/30 bg-green-500/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-green-400">参数配置优秀</h4>
            <p className="text-sm text-space-300">所有指标均在理想范围内，继续保持！</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-bg rounded-lg p-4 border border-tech-500/30">
      <h3 className="font-orbitron text-tech-400 text-sm font-semibold mb-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        误差溯源分析
      </h3>
      
      <div className="space-y-3">
        {errors.map((error, idx) => {
          const severity = severityColors[error.severity];
          const isExpanded = expandedError === error.type;
          
          return (
            <div
              key={idx}
              className={`rounded-lg border ${severity.bg} ${severity.border} overflow-hidden`}
            >
              <div
                className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpandedError(isExpanded ? null : error.type)}
              >
                <div className="flex items-center gap-3">
                  {severity.icon}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${severity.text}`}>
                        {errorLabels[error.type]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${severity.bg} ${severity.text}`}>
                        {error.severity === 'low' ? '轻微' : error.severity === 'medium' ? '中等' : '严重'}
                      </span>
                    </div>
                    <p className="text-sm text-space-300 mt-1">{error.impact}</p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-space-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-space-400" />
                  )}
                </div>
              </div>
              
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-white/10">
                  <div className="pt-3 space-y-3">
                    <div>
                      <h5 className="text-xs font-semibold text-space-200 mb-2">计算过程</h5>
                      {error.calculation.map((step, sIdx) => (
                        <div key={sIdx} className="bg-space-800/50 rounded p-2 text-xs mb-2">
                          <div className="font-mono text-tech-300 mb-1">{step.formula}</div>
                          <div className="text-space-400">
                            输入: {Object.entries(step.inputs).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(', ')}
                          </div>
                          <div className="text-tech-400 font-semibold">
                            结果: {step.result.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-start gap-2 p-2 bg-tech-500/10 rounded border border-tech-500/20">
                      <Lightbulb className="w-4 h-4 text-tech-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-semibold text-tech-400 mb-1">改进建议</h5>
                        <p className="text-xs text-space-300">{error.suggestion}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
