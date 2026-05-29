import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Calculator } from 'lucide-react';
import type { CalculationStep } from '@/types';

interface CalculationStepsProps {
  steps: CalculationStep[];
  title?: string;
  defaultExpanded?: boolean;
}

export const CalculationSteps: React.FC<CalculationStepsProps> = ({
  steps,
  title = '计算过程',
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-industrial-800/50 border border-industrial-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-industrial-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calculator size={16} className="text-tech-400" />
          <span className="font-display text-sm font-medium text-gray-200">{title}</span>
          <span className="text-xs text-gray-500 font-mono">({steps.length} 步)</span>
        </div>
        {isExpanded ? (
          <ChevronDown size={16} className="text-gray-400" />
        ) : (
          <ChevronRight size={16} className="text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-industrial-700 max-h-96 overflow-y-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`px-4 py-3 ${index !== steps.length - 1 ? 'border-b border-industrial-700/50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-tech-500/20 border border-tech-500/30 flex items-center justify-center">
                  <span className="text-xs font-mono text-tech-400 font-bold">{step.step}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 font-medium">{step.description}</p>
                  <div className="mt-2 p-2 bg-industrial-900 rounded font-mono text-xs text-tech-300 overflow-x-auto">
                    {step.formula}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(step.variables).map(([key, value]) => (
                      <span
                        key={key}
                        className="px-2 py-0.5 bg-industrial-700/50 rounded text-xs font-mono text-gray-300"
                      >
                        {key} = {typeof value === 'number' ? value.toFixed(4) : value}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-400">结果:</span>
                    <span className="font-mono text-sm text-alert-green font-semibold">
                      {step.result.toFixed(6)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
