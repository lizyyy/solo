import React from 'react';
import { GaugeChart } from '../common/GaugeChart';
import { formatCurrency, formatPercent } from '../../utils/calculations';

interface DashboardProps {
  cash: number;
  totalAssets: number;
  trackingError: number;
  round: number;
  maxRounds: number;
}

export const Dashboard: React.FC<DashboardProps> = ({
  cash,
  totalAssets,
  trackingError,
  round,
  maxRounds,
}) => {
  const cashRatio = totalAssets > 0 ? cash / totalAssets : 0;
  const portfolioReturn = totalAssets > 0 ? (totalAssets - 100000000) / 100000000 : 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">📊 实时仪表盘</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <GaugeChart
          value={trackingError}
          max={0.1}
          label="跟踪误差"
          warningThreshold={0.03}
          criticalThreshold={0.05}
        />
        <GaugeChart
          value={cashRatio}
          max={0.3}
          label="现金比例"
          warningThreshold={0.1}
          criticalThreshold={0.2}
        />
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-800 font-mono">
              {formatCurrency(totalAssets)}
            </div>
            <div className="text-sm text-gray-500">总资产</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold font-mono ${portfolioReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {portfolioReturn >= 0 ? '+' : ''}{formatPercent(portfolioReturn)}
            </div>
            <div className="text-sm text-gray-500">累计收益</div>
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-full">
            <span className="text-sm">回合</span>
            <span className="text-xl font-bold">{round}</span>
            <span className="text-sm text-gray-400">/ {maxRounds}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
