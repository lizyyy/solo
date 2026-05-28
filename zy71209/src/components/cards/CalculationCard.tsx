import type { PledgeCalculation } from '../../types';
import { Calculator, Info } from 'lucide-react';

interface CalculationCardProps {
  calculation: PledgeCalculation | null;
}

export function CalculationCard({ calculation }: CalculationCardProps) {
  if (!calculation) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-[#1e3a5f]" />
          <h3 className="text-lg font-bold text-gray-900">质押率计算</h3>
        </div>
        <p className="text-gray-500 text-sm">暂无计算数据</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-[#1e3a5f]" />
          <h3 className="text-lg font-bold text-gray-900">质押率计算</h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Info className="w-3.5 h-3.5" />
          <span>实时计算，透明可追溯</span>
        </div>
      </div>

      <div className="space-y-3">
        {calculation.calculationSteps.map((step, index) => (
          <div
            key={index}
            className={`flex items-center justify-between py-2 px-3 rounded ${
              index === calculation.calculationSteps.length - 1
                ? 'bg-[#1e3a5f]/5 border border-[#1e3a5f]/20'
                : 'border-b border-gray-100 last:border-0'
            }`}
          >
            <div className="flex-1">
              <span className="text-sm text-gray-700">{step.label}</span>
              {step.formula && (
                <div className="text-xs text-gray-400 mt-0.5 font-mono">
                  {step.formula}
                </div>
              )}
            </div>
            <span
              className={`font-medium ${
                index === calculation.calculationSteps.length - 1
                  ? calculation.isClose
                    ? 'text-red-600'
                    : calculation.isWarning
                    ? 'text-orange-600'
                    : 'text-green-600'
                  : 'text-gray-900'
              }`}
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {step.value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 mb-1">有效价格</p>
            <p
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              ¥{calculation.effectivePrice.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">质押市值</p>
            <p
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {(calculation.marketValue / 10000).toFixed(2)}万
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">安全缓冲</p>
            <p
              className={`text-lg font-bold ${
                calculation.warningBuffer < 0 ? 'text-red-600' : 'text-green-600'
              }`}
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {calculation.warningBuffer >= 0 ? '+' : ''}
              {calculation.warningBuffer.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
