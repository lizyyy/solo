import { TrendingUp, TrendingDown } from 'lucide-react';
import { useGameLogic } from '../../hooks/useGameLogic';
import { formatCurrency, formatPercent, getReturnColor } from '../../utils/formatters';

export function PositionTable() {
  const { positions, totalMarketValue, currentCapital, totalAssets } = useGameLogic();

  return (
    <div className="card">
      <h3 className="font-serif text-lg font-semibold mb-4">持仓概览</h3>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left py-2 px-2 font-medium text-neutral-500">标的</th>
              <th className="text-right py-2 px-2 font-medium text-neutral-500">持仓</th>
              <th className="text-right py-2 px-2 font-medium text-neutral-500">成本</th>
              <th className="text-right py-2 px-2 font-medium text-neutral-500">现价</th>
              <th className="text-right py-2 px-2 font-medium text-neutral-500">市值</th>
              <th className="text-right py-2 px-2 font-medium text-neutral-500">盈亏</th>
            </tr>
          </thead>
          <tbody>
            {positions.length > 0 ? (
              positions.map((pos) => (
                <tr key={pos.symbol} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-3 px-2">
                    <div className="font-medium">{pos.name}</div>
                    <div className="text-xs text-neutral-400 font-mono">{pos.symbol}</div>
                  </td>
                  <td className="text-right py-3 px-2 font-mono">
                    {pos.quantity.toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-2 font-mono text-neutral-500">
                    {formatCurrency(pos.avgCost)}
                  </td>
                  <td className="text-right py-3 px-2 font-mono">
                    {formatCurrency(pos.currentPrice)}
                  </td>
                  <td className="text-right py-3 px-2 font-mono">
                    {formatCurrency(pos.marketValue)}
                  </td>
                  <td className="text-right py-3 px-2">
                    <div className={`font-mono font-medium ${getReturnColor(pos.profitLossPercent)}`}>
                      <div className="flex items-center justify-end gap-1">
                        {pos.profitLoss >= 0 ? (
                          <TrendingUp size={14} className="text-success-500" />
                        ) : (
                          <TrendingDown size={14} className="text-danger-500" />
                        )}
                        {formatCurrency(pos.profitLoss)}
                      </div>
                      <div className="text-xs">{formatPercent(pos.profitLossPercent)}</div>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-8 text-neutral-400">
                  暂无持仓
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-200 grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <p className="text-xs text-neutral-500 mb-1">可用资金</p>
          <p className="font-mono font-medium">{formatCurrency(currentCapital)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-neutral-500 mb-1">持仓市值</p>
          <p className="font-mono font-medium">{formatCurrency(totalMarketValue)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-neutral-500 mb-1">总资产</p>
          <p className="font-mono font-medium text-primary-600">{formatCurrency(totalAssets)}</p>
        </div>
      </div>
    </div>
  );
}
