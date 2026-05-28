import React, { useState } from 'react';
import { DollarSign, TrendingUp, Clock, Award, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useSolarStore } from '../../store/useSolarStore';
import { calculateSystemCost, getEconomicSummary } from '../../engine/profitCalc';

export const ProfitCard: React.FC = () => {
  const { results, params } = useSolarStore();
  const [showDetail, setShowDetail] = useState(false);

  const systemCost = calculateSystemCost({
    panelPower: params.panelPower,
    panelCount: params.panelCount,
    panelPrice: params.panelPrice,
  });

  const summary = getEconomicSummary({
    annualEnergy: results.annualEnergy,
    electricityPrice: params.electricityPrice,
    systemCost,
    annualProfit: results.annualProfit,
    paybackYears: results.paybackYears,
  });

  const profitRating =
    results.paybackYears <= 5
      ? { label: '优秀', color: 'text-green-600', bg: 'bg-green-100' }
      : results.paybackYears <= 8
      ? { label: '良好', color: 'text-blue-600', bg: 'bg-blue-100' }
      : results.paybackYears <= 10
      ? { label: '一般', color: 'text-amber-600', bg: 'bg-amber-100' }
      : { label: '待优化', color: 'text-red-600', bg: 'bg-red-100' };

  return (
    <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl shadow-lg p-5 text-white">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-6 h-6" />
        <h3 className="font-semibold text-lg">收益分析</h3>
        <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${profitRating.bg} ${profitRating.color}`}>
          {profitRating.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white/10 rounded-lg p-3">
          <div className="flex items-center gap-1 text-emerald-200 text-xs mb-1">
            <TrendingUp className="w-3 h-3" />
            年收益
          </div>
          <div className="text-2xl font-bold">¥{results.annualProfit.toLocaleString()}</div>
        </div>
        <div className="bg-white/10 rounded-lg p-3">
          <div className="flex items-center gap-1 text-emerald-200 text-xs mb-1">
            <Clock className="w-3 h-3" />
            投资回收期
          </div>
          <div className="text-2xl font-bold">{results.paybackYears}年</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex justify-between">
          <span className="text-emerald-200">总投资</span>
          <span className="font-medium">¥{(systemCost / 10000).toFixed(1)}万</span>
        </div>
        <div className="flex justify-between">
          <span className="text-emerald-200">25年总收益</span>
          <span className="font-medium">¥{Math.round(results.annualProfit * 25 - systemCost).toLocaleString()}</span>
        </div>
      </div>

      <button
        onClick={() => setShowDetail(!showDetail)}
        className="w-full mt-3 flex items-center justify-between gap-2 bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-colors text-sm"
      >
        <span className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          收益说明
        </span>
        {showDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showDetail && (
        <div className="mt-3 bg-white/10 rounded-lg p-3 text-sm">
          <p className="text-emerald-100 leading-relaxed text-xs">{summary}</p>
          <div className="mt-2 pt-2 border-t border-white/20 text-xs text-emerald-200 space-y-1">
            <div>• 电价: ¥{params.electricityPrice}/kWh（居民用电基准）</div>
            <div>• 系统效率: 约80%（含逆变器、线损等）</div>
            <div>• 年衰减: 首年2%，之后每年0.5%</div>
            <div>• 计算周期: 25年组件寿命</div>
          </div>
        </div>
      )}
    </div>
  );
};
