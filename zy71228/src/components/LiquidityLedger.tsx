import { TrendingUp, TrendingDown, AlertTriangle, Clock, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import type { MarketState, LiquidityLog, PolicyAction } from '@/types/game';
import { StatusBadge } from './StatusBadge';

interface LiquidityLedgerProps {
  currentMarket: MarketState;
  logs: LiquidityLog[];
  roundActions: PolicyAction[];
}

export function LiquidityLedger({ currentMarket, logs, roundActions }: LiquidityLedgerProps) {
  const excessRatioPercent = (currentMarket.excessReserveRatio * 100).toFixed(2);
  
  const getExcessStatus = () => {
    if (currentMarket.excessReserveRatio < 0.015) return 'danger';
    if (currentMarket.excessReserveRatio > 0.025) return 'warning';
    return 'normal';
  };

  const getMaturityStatus = () => {
    if (currentMarket.maturityGap >= 14) return 'danger';
    if (currentMarket.maturityGap >= 7) return 'warning';
    return 'normal';
  };

  const confirmedAmount = roundActions
    .filter(a => a.status === 'confirmed')
    .reduce((sum, a) => {
      const multiplier = a.direction === 'inject' ? 1 : -1;
      return sum + a.amount * multiplier;
    }, 0);

  return (
    <div className="bg-navy-800/50 backdrop-blur-sm rounded-xl border border-navy-600 p-4">
      <h3 className="text-sm font-semibold text-gold-400 mb-4 flex items-center gap-2">
        <DollarSign size={16} />
        流动性账本
      </h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-navy-900/50 rounded-lg p-3">
          <div className="text-xs text-navy-400 mb-1">银行体系流动性</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-liquidity-good">
              {currentMarket.liquidity.toLocaleString()}
            </span>
            <span className="text-xs text-navy-400">亿</span>
          </div>
          {confirmedAmount !== 0 && (
            <div className={`text-xs mt-1 font-mono flex items-center gap-1 ${
              confirmedAmount > 0 ? 'text-liquidity-good' : 'text-liquidity-danger'
            }`}>
              {confirmedAmount > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              本轮预计 {confirmedAmount > 0 ? '+' : ''}{confirmedAmount.toLocaleString()} 亿
            </div>
          )}
        </div>

        <div className="bg-navy-900/50 rounded-lg p-3">
          <div className="text-xs text-navy-400 mb-1">超额准备金率</div>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold font-mono ${
              getExcessStatus() === 'danger' ? 'text-liquidity-danger' :
              getExcessStatus() === 'warning' ? 'text-yellow-400' : 'text-liquidity-good'
            }`}>
              {excessRatioPercent}%
            </span>
            <StatusBadge type="risk" status={getExcessStatus()} />
          </div>
          <div className="text-xs text-navy-400 mt-1">目标区间: 1.5%-2.5%</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 bg-navy-900/50 rounded-lg">
          <Clock className="text-gold-400 mt-0.5" size={16} />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-navy-400">期限错配程度</span>
              <StatusBadge type="risk" status={getMaturityStatus()} />
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-sm ${
                getMaturityStatus() === 'danger' ? 'text-liquidity-danger' :
                getMaturityStatus() === 'warning' ? 'text-yellow-400' : 'text-navy-200'
              }`}>
                {currentMarket.maturityGap.toFixed(1)} 天
              </span>
              <div className="flex-1 h-2 bg-navy-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (currentMarket.maturityGap / 20) * 100)}%` }}
                  className={`h-full ${
                    getMaturityStatus() === 'danger' ? 'bg-liquidity-danger' :
                    getMaturityStatus() === 'warning' ? 'bg-yellow-400' : 'bg-liquidity-good'
                  }`}
                />
              </div>
            </div>
            {getMaturityStatus() !== 'normal' && (
              <div className="flex items-center gap-1 mt-1 text-xs text-yellow-400">
                <AlertTriangle size={12} />
                期限结构偏离目标（14天）
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-navy-900/50 rounded-lg">
          <TrendingUp className="text-gold-400 mt-0.5" size={16} />
          <div className="flex-1">
            <div className="text-xs text-navy-400 mb-1">利率传导滞后效应</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-navy-200">
                {(currentMarket.rateLagEffect * 100).toFixed(0)}%
              </span>
              <div className="flex-1 h-2 bg-navy-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${currentMarket.rateLagEffect * 100}%` }}
                  className="h-full bg-gold-400"
                />
              </div>
            </div>
            <div className="text-xs text-navy-500 mt-1">
              政策效果将在下回合逐步显现
            </div>
          </div>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-navy-600">
          <div className="text-xs text-navy-400 mb-2">历史变动记录</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {logs.slice(-5).reverse().map((log) => (
              <div key={log.id} className="flex items-center justify-between text-xs font-mono py-1">
                <span className="text-navy-400">R{log.roundNumber}</span>
                <span className={log.afterValue > log.beforeValue ? 'text-liquidity-good' : 'text-liquidity-danger'}>
                  {log.afterValue > log.beforeValue ? '+' : ''}{(log.afterValue - log.beforeValue).toLocaleString()}
                </span>
                <span className="text-navy-500 truncate ml-2">{log.changeReason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
