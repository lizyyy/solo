import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react';
import { NumberScroll } from '../common/NumberScroll';
import { StatusBadge } from '../common/StatusBadge';
import { useGameLogic } from '../../hooks/useGameLogic';
import { formatCurrency, formatPercent, getReturnColor } from '../../utils/formatters';

export function StatusBoard() {
  const {
    status,
    currentRound,
    totalRounds,
    marketIndex,
    currentCapital,
    totalAssets,
    totalAssetsReturn,
    totalAssetsReturnPercent,
    settlementReason,
  } = useGameLogic();

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg font-semibold">对局状态</h3>
        <StatusBadge status={status} type="game" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-neutral-50 rounded">
          <p className="text-xs text-neutral-500 mb-1">当前回合</p>
          <p className="text-3xl font-bold font-serif text-primary-600">
            <NumberScroll value={currentRound} decimals={0} />
            <span className="text-lg text-neutral-400">/{totalRounds}</span>
          </p>
        </div>
        <div className="text-center p-3 bg-neutral-50 rounded">
          <p className="text-xs text-neutral-500 mb-1">大盘指数</p>
          <p className="text-2xl font-bold font-mono flex items-center justify-center gap-1">
            {marketIndex >= 3150 ? (
              <TrendingUp size={20} className="text-success-500" />
            ) : (
              <TrendingDown size={20} className="text-danger-500" />
            )}
            <NumberScroll value={marketIndex} decimals={0} />
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-2 bg-neutral-50 rounded">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-neutral-400" />
            <span className="text-sm text-neutral-600">可用资金</span>
          </div>
          <span className="font-mono font-medium text-sm">
            {formatCurrency(currentCapital)}
          </span>
        </div>
        <div className="flex items-center justify-between p-2 bg-neutral-50 rounded">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-neutral-400" />
            <span className="text-sm text-neutral-600">总资产</span>
          </div>
          <span className="font-mono font-medium text-sm">
            {formatCurrency(totalAssets)}
          </span>
        </div>
        <div className="flex items-center justify-between p-2 bg-neutral-50 rounded">
          <div className="flex items-center gap-2">
            {totalAssetsReturn >= 0 ? (
              <TrendingUp size={16} className="text-success-500" />
            ) : (
              <TrendingDown size={16} className="text-danger-500" />
            )}
            <span className="text-sm text-neutral-600">总收益</span>
          </div>
          <span className={`font-mono font-medium text-sm ${getReturnColor(totalAssetsReturnPercent)}`}>
            {formatCurrency(totalAssetsReturn)} ({formatPercent(totalAssetsReturnPercent)})
          </span>
        </div>
      </div>

      {settlementReason && (
        <div className="mt-4 p-3 bg-warning-50 rounded border border-warning-200">
          <p className="text-xs text-warning-700">
            <span className="font-medium">结算原因：</span>
            {settlementReason}
          </p>
        </div>
      )}
    </div>
  );
}
