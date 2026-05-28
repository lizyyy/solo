import React from 'react';
import { AlertTriangle, DollarSign, TrendingDown, ShieldAlert } from 'lucide-react';
import type { MarginStatus } from '@/types';
import { getMarginUsagePercent, getMarginStatusColor } from '@/engine/marginCalculator';
import { formatCurrency, formatNumber } from '@/utils/format';

interface MarginGaugeProps {
  margin: MarginStatus;
  cash: number;
  maintenanceMarginRate: number;
}

export const MarginGauge: React.FC<MarginGaugeProps> = ({
  margin,
  cash,
  maintenanceMarginRate,
}) => {
  const usagePercent = getMarginUsagePercent(margin, cash);
  const statusColor = getMarginStatusColor(usagePercent);

  const colorClasses = {
    green: {
      stroke: '#2ECC71',
      bg: 'bg-trader-green/20',
      text: 'text-trader-green',
      glow: 'shadow-trader-green/30',
    },
    yellow: {
      stroke: '#FF9F1C',
      bg: 'bg-warning-orange/20',
      text: 'text-warning-orange',
      glow: 'shadow-warning-orange/30',
    },
    red: {
      stroke: '#E63946',
      bg: 'bg-trader-red/20',
      text: 'text-trader-red',
      glow: 'shadow-trader-red/30',
    },
  };

  const colors = colorClasses[statusColor];
  const circumference = Math.PI * 180;
  const strokeDashoffset = circumference * (1 - usagePercent / 100);

  const totalAssets = cash + margin.initialMargin;

  return (
    <div className="bg-bloomberg-panel rounded-xl border border-bloomberg-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold">保证金监控</h3>
        {margin.marginCall && (
          <div className="flex items-center gap-2 px-3 py-1 bg-trader-red/20 border border-trader-red/50 rounded-full animate-pulse">
            <ShieldAlert size={16} className="text-trader-red" />
            <span className="text-sm font-bold text-trader-red">追缴通知</span>
          </div>
        )}
      </div>

      <div className="flex items-start gap-6">
        <div className="relative">
          <svg width="200" height="120" className="transform -rotate-90">
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="rgba(26, 61, 42, 0.5)"
              strokeWidth="16"
              strokeDasharray={`${Math.PI * 180}`}
              strokeDashoffset="0"
              strokeLinecap="round"
            />
            
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke={colors.stroke}
              strokeWidth="16"
              strokeDasharray={`${Math.PI * 180}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000"
              style={{
                filter: `drop-shadow(0 0 8px ${colors.stroke}40)`,
              }}
            />
            
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="rgba(255, 159, 28, 0.5)"
              strokeWidth="2"
              strokeDasharray={`${Math.PI * 180}`}
              strokeDashoffset={circumference * (1 - 0.8)}
              strokeLinecap="round"
              opacity="0.5"
            />
            
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="rgba(230, 57, 70, 0.5)"
              strokeWidth="2"
              strokeDasharray={`${Math.PI * 180}`}
              strokeDashoffset={circumference * (1 - 0.6)}
              strokeLinecap="round"
              opacity="0.5"
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
            <div className={`text-4xl font-mono font-bold ${colors.text} text-shadow-glow`}>
              {formatNumber(usagePercent, 0)}%
            </div>
            <div className="text-xs text-bloomberg-muted">使用率</div>
          </div>
          
          <div className="absolute -bottom-2 left-4 text-xs text-bloomberg-muted">0%</div>
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-warning-orange">60%</div>
          <div className="absolute -bottom-2 right-4 text-xs text-trader-red">80%</div>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between p-3 bg-bloomberg-bg/50 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-bloomberg-muted" />
              <span className="text-sm text-bloomberg-muted">现金余额</span>
            </div>
            <span className="font-mono font-bold text-bloomberg-text">
              {formatCurrency(cash)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-bloomberg-bg/50 rounded-lg">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-highlight-blue" />
              <span className="text-sm text-bloomberg-muted">初始保证金</span>
            </div>
            <span className="font-mono font-bold text-highlight-blue">
              {formatCurrency(margin.initialMargin)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-bloomberg-bg/50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-warning-orange" />
              <span className="text-sm text-bloomberg-muted">维持保证金</span>
            </div>
            <span className="font-mono font-bold text-warning-orange">
              {formatCurrency(margin.maintenanceMargin)}
              <span className="text-xs text-bloomberg-muted ml-1">
                ({(maintenanceMarginRate * 100).toFixed(0)}%)
              </span>
            </span>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-lg ${
            margin.availableMargin >= 0 
              ? 'bg-trader-green/10 border border-trader-green/30' 
              : 'bg-trader-red/10 border border-trader-red/30'
          }`}>
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className={margin.availableMargin >= 0 ? 'text-trader-green' : 'text-trader-red'} />
              <span className="text-sm text-bloomberg-muted">可用保证金</span>
            </div>
            <span className={`font-mono font-bold ${margin.availableMargin >= 0 ? 'text-trader-green' : 'text-trader-red'}`}>
              {margin.availableMargin >= 0 ? '+' : ''}{formatCurrency(margin.availableMargin)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-bloomberg-bg/50 rounded-lg">
            <span className="text-sm text-bloomberg-muted">总资产</span>
            <span className="font-mono font-bold text-bloomberg-text">
              {formatCurrency(totalAssets)}
            </span>
          </div>
        </div>
      </div>

      {usagePercent > 80 && (
        <div className="mt-4 p-3 bg-trader-red/10 border border-trader-red/30 rounded-lg animate-pulse">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-trader-red mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-trader-red">风险警告</div>
              <div className="text-xs text-bloomberg-muted mt-1">
                保证金使用率已超过80%，请立即减仓或补充保证金，否则可能触发强制平仓！
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
